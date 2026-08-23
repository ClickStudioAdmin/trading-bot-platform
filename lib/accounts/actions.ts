"use server";

import { insertTradingAccount, listTradingAccounts } from "@/lib/accounts/store";
import { parseAccountMode, parseAccountName } from "@/lib/accounts/model";
import { writeEventLog } from "@/lib/logs/write";
import {
  getSessionContext,
  getSessionMember,
  setActiveAccountId,
} from "@/lib/auth/session";
import { redirect } from "next/navigation";

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
  const named = parseAccountName(formData.get("name"));
  if (!named.ok) {
    redirect(`/accounts/new?error=${encodeURIComponent(named.error)}`);
  }
  const mode = parseAccountMode(formData.get("mode"));
  const created = await insertTradingAccount(
    session.member.id,
    named.name,
    mode,
  );
  if (!created) {
    redirect(
      `/accounts/new?error=${encodeURIComponent("Could not create that account. The name may already be in use.")}`,
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
  await setActiveAccountId(created.id);
  redirect("/strategies/cash-and-carry");
}
