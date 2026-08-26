"use server";

import {
  deleteTradingAccountRow,
  insertTradingAccount,
  listTradingAccounts,
  renameTradingAccountRow,
} from "@/lib/accounts/store";
import {
  parseAccountMode,
  parseAccountName,
  parseDeskTypeChoice,
  pickSwitchAfterDelete,
} from "@/lib/accounts/model";
import { writeEventLog } from "@/lib/logs/write";
import {
  getSessionContext,
  getSessionMember,
  setActiveAccountId,
} from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const SUB_ACCOUNTS_PATH = "/account/sub-accounts";

function refreshAccountChrome() {
  revalidatePath("/", "layout");
  revalidatePath("/account");
  revalidatePath("/account/book");
  revalidatePath(SUB_ACCOUNTS_PATH);
  revalidatePath("/account/exchanges");
}

function accountReturnPath(
  raw: string,
): "/account" | typeof SUB_ACCOUNTS_PATH | "/strategies/cash-and-carry" {
  if (raw === SUB_ACCOUNTS_PATH || raw === "/accounts") {
    return SUB_ACCOUNTS_PATH;
  }
  if (raw === "/account") {
    return "/account";
  }
  return "/strategies/cash-and-carry";
}

function staysOnManagePage(
  next: ReturnType<typeof accountReturnPath>,
): next is typeof SUB_ACCOUNTS_PATH {
  return next === SUB_ACCOUNTS_PATH;
}

export async function switchTradingAccount(formData: FormData) {
  const user = await getSessionMember();
  if (!user) {
    redirect("/sign-in");
  }
  const accountId = String(formData.get("accountId") ?? "");
  const accounts = await listTradingAccounts(user.id);
  const match = accounts.find((account) => account.id === accountId);
  if (!match) {
    redirect("/strategies/cash-and-carry");
  }
  await setActiveAccountId(match.id);
  refreshAccountChrome();
  redirect(accountReturnPath(String(formData.get("next") ?? "")));
}

export async function createTradingAccount(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const next = accountReturnPath(String(formData.get("next") ?? ""));
  const named = parseAccountName(formData.get("name"));
  if (!named.ok) {
    redirect(`${SUB_ACCOUNTS_PATH}?error=${encodeURIComponent(named.error)}`);
  }
  const typed = parseDeskTypeChoice(formData.get("deskType"));
  if (!typed.ok) {
    redirect(`${SUB_ACCOUNTS_PATH}?error=${encodeURIComponent(typed.error)}`);
  }
  const mode = parseAccountMode(formData.get("mode"));
  const created = await insertTradingAccount(
    session.member.id,
    named.name,
    mode,
    typed.deskType,
  );
  if (!created) {
    redirect(
      `${SUB_ACCOUNTS_PATH}?error=${encodeURIComponent("Could not create that account. The name may already be in use.")}`,
    );
  }
  await writeEventLog({
    scope: "system",
    event: "account.created",
    message: `Created ${mode} account ${named.name}`,
    userId: session.member.id,
    accountId: created.id,
    data: { mode, name: named.name, deskType: typed.deskType },
  });
  if (!staysOnManagePage(next)) {
    await setActiveAccountId(created.id);
  }
  refreshAccountChrome();
  redirect(staysOnManagePage(next) ? `${SUB_ACCOUNTS_PATH}?created=1` : next);
}

export async function deleteTradingAccount(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const accountId = String(formData.get("accountId") ?? "");
  const written = await deleteTradingAccountRow(session.member.id, accountId);
  if (written.error) {
    redirect(`${SUB_ACCOUNTS_PATH}?error=${encodeURIComponent(written.error)}`);
  }
  await writeEventLog({
    scope: "system",
    event: "account.deleted",
    message: "Deleted a trading account",
    userId: session.member.id,
    data: { accountId },
  });
  if (session.account.id === accountId) {
    const remaining = await listTradingAccounts(session.member.id);
    const next = pickSwitchAfterDelete(
      remaining,
      formData.get("switchToAccountId"),
    );
    if (next) {
      await setActiveAccountId(next.id);
    }
  }
  refreshAccountChrome();
  redirect(`${SUB_ACCOUNTS_PATH}?deleted=1`);
}

export async function renameTradingAccount(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const accountId = String(formData.get("accountId") ?? "");
  const named = parseAccountName(formData.get("name"));
  if (!named.ok) {
    redirect(`${SUB_ACCOUNTS_PATH}?error=${encodeURIComponent(named.error)}`);
  }
  const accounts = await listTradingAccounts(session.member.id);
  const target = accounts.find((account) => account.id === accountId);
  if (!target) {
    redirect(
      `${SUB_ACCOUNTS_PATH}?error=${encodeURIComponent("That account was not found.")}`,
    );
  }
  if (target.name === named.name) {
    redirect(SUB_ACCOUNTS_PATH);
  }
  const written = await renameTradingAccountRow(
    session.member.id,
    accountId,
    named.name,
  );
  if (written.error) {
    redirect(`${SUB_ACCOUNTS_PATH}?error=${encodeURIComponent(written.error)}`);
  }
  await writeEventLog({
    scope: "system",
    event: "account.renamed",
    message: `Renamed account to ${named.name}`,
    userId: session.member.id,
    accountId,
    data: { name: named.name },
  });
  refreshAccountChrome();
  redirect(`${SUB_ACCOUNTS_PATH}?renamed=1`);
}
