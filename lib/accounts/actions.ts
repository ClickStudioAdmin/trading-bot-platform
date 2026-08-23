"use server";

import {
  deleteTradingAccountRow,
  insertTradingAccount,
  listTradingAccounts,
} from "@/lib/accounts/store";
import {
  parseAccountMode,
  parseAccountName,
  pickDefaultAccount,
} from "@/lib/accounts/model";
import { writeEventLog } from "@/lib/logs/write";
import {
  getSessionContext,
  getSessionMember,
  setActiveAccountId,
} from "@/lib/auth/session";
import { redirect } from "next/navigation";

function accountReturnPath(raw: string): "/accounts" | "/strategies/cash-and-carry" {
  return raw === "/accounts" ? "/accounts" : "/strategies/cash-and-carry";
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
  redirect("/strategies/cash-and-carry");
}

export async function createTradingAccount(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const next = accountReturnPath(String(formData.get("next") ?? ""));
  const named = parseAccountName(formData.get("name"));
  if (!named.ok) {
    redirect(`/accounts?error=${encodeURIComponent(named.error)}`);
  }
  const mode = parseAccountMode(formData.get("mode"));
  const created = await insertTradingAccount(
    session.member.id,
    named.name,
    mode,
  );
  if (!created) {
    redirect(
      `/accounts?error=${encodeURIComponent("Could not create that account. The name may already be in use.")}`,
    );
  }
  await writeEventLog({
    scope: "system",
    event: "account.created",
    message: `Created ${mode} account ${named.name}`,
    userId: session.member.id,
    accountId: created.id,
    data: { mode, name: named.name },
  });
  if (next !== "/accounts") {
    await setActiveAccountId(created.id);
  }
  redirect(next === "/accounts" ? "/accounts?created=1" : next);
}

export async function deleteTradingAccount(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const accountId = String(formData.get("accountId") ?? "");
  const written = await deleteTradingAccountRow(session.member.id, accountId);
  if (written.error) {
    redirect(`/accounts?error=${encodeURIComponent(written.error)}`);
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
    const next = pickDefaultAccount(remaining);
    if (next) {
      await setActiveAccountId(next.id);
    }
  }
  redirect("/accounts?deleted=1");
}
