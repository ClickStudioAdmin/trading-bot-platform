"use server";

import {
  bindConnectionToDesk,
  deleteTradingAccountRow,
  insertTradingAccount,
  listTradingAccounts,
  renameTradingAccountRow,
} from "@/lib/accounts/store";
import {
  parseDeskCreateChoice,
  pickSwitchAfterDelete,
  deskHomePath,
  validateNewDeskName,
  DESK_NAME_TAKEN,
  otherDeskNames,
  parseDeskNameChange,
} from "@/lib/accounts/model";
import { parseBoundConnectionId } from "@/lib/exchanges/connections";
import { listExchangeConnections } from "@/lib/exchanges/store";
import {
  connectionFitsDesk,
  parseStoredVenueEnvironment,
} from "@/lib/exchanges/venues";
import { writeEventLog } from "@/lib/logs/write";
import { WELCOME_PATH } from "@/lib/auth/onboarding-path";
import {
  getSessionContext,
  getSessionMember,
  setActiveAccountId,
} from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const SUB_ACCOUNTS_PATH = "/account/sub-accounts";

function createDeskErrorPath(
  formData: FormData,
  message: string,
  firstDesk: boolean,
): string {
  const next = String(formData.get("next") ?? "");
  if (firstDesk || next === WELCOME_PATH) {
    return `${WELCOME_PATH}?error=${encodeURIComponent(message)}`;
  }
  if (next.startsWith("/account/desks/new")) {
    const typed = String(formData.get("deskType") ?? "").trim();
    const params = new URLSearchParams();
    if (typed) {
      params.set("type", typed);
    }
    params.set("error", message);
    return `/account/desks/new?${params}`;
  }
  return `${SUB_ACCOUNTS_PATH}?error=${encodeURIComponent(message)}`;
}

function refreshAccountChrome() {
  revalidatePath("/", "layout");
  revalidatePath("/account");
  revalidatePath("/account/book");
  revalidatePath(SUB_ACCOUNTS_PATH);
  revalidatePath("/account/exchanges");
}

function accountReturnPath(
  raw: string,
): "/account" | typeof SUB_ACCOUNTS_PATH | null {
  if (raw === SUB_ACCOUNTS_PATH || raw === "/accounts") {
    return SUB_ACCOUNTS_PATH;
  }
  if (raw === "/account") {
    return "/account";
  }
  return null;
}

function staysOnManagePage(
  next: ReturnType<typeof accountReturnPath>,
): next is typeof SUB_ACCOUNTS_PATH {
  return next === SUB_ACCOUNTS_PATH;
}

function safeStayPath(raw: unknown): string | null {
  const path = String(raw ?? "").trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return null;
  }
  return path;
}

export async function rememberTradingAccount(accountId: string) {
  const user = await getSessionMember();
  if (!user) {
    return;
  }
  const accounts = await listTradingAccounts(user.id);
  const match = accounts.find((account) => account.id === accountId);
  if (!match) {
    return;
  }
  await setActiveAccountId(match.id);
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
    redirect("/strategies");
  }
  await setActiveAccountId(match.id);
  refreshAccountChrome();
  const next = accountReturnPath(String(formData.get("next") ?? ""));
  redirect(next ?? deskHomePath(match.deskType, match.id));
}

export async function createTradingAccount(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const next = accountReturnPath(String(formData.get("next") ?? ""));
  const fromWelcome = String(formData.get("next") ?? "") === WELCOME_PATH;
  const desks = await listTradingAccounts(member.id);
  const firstDesk = desks.length === 0;
  const switchToNew = firstDesk || fromWelcome || formData.get("switchToDesk") === "1";
  const fail = (message: string): never =>
    redirect(createDeskErrorPath(formData, message, firstDesk));
  const named = validateNewDeskName(
    formData.get("name"),
    desks.map((desk) => desk.name),
  );
  if (!named.ok) {
    return fail(named.error);
  }
  const createdChoice = parseDeskCreateChoice({
    deskType: formData.get("deskType"),
    venue: formData.get("venue"),
    mode: formData.get("mode"),
    track: formData.get("track"),
  });
  if (!createdChoice.ok) {
    return fail(createdChoice.error);
  }
  const choice = createdChoice.value;
  let connectionId: string | null = null;
  let venueEnvironment = choice.venueEnvironment;
  if (choice.mode === "live") {
    connectionId = parseBoundConnectionId(formData.get("exchangeConnectionId"));
    if (connectionId) {
      const connections = await listExchangeConnections(member.id);
      const match = connections.find((item) => item.id === connectionId);
      if (!match || match.status !== "active") {
        return fail("Pick an exchange key saved on this login.");
      }
      const fit = connectionFitsDesk({
        deskVenue: choice.venue,
        deskEnvironment: venueEnvironment,
        connectionVenue: match.venue,
        connectionEnvironment: match.environment,
      });
      if (!fit.ok) {
        return fail(fit.error);
      }
      if (!venueEnvironment) {
        venueEnvironment = parseStoredVenueEnvironment(
          choice.venue,
          match.environment,
        );
      }
    }
  }
  const created = await insertTradingAccount(
    member.id,
    named.name,
    choice.mode,
    choice.deskType,
    { venue: choice.venue, venueEnvironment },
  );
  if (!created) {
    return fail("Could not create that desk. The name may already be in use.");
  }
  if (connectionId) {
    const bound = await bindConnectionToDesk({
      userId: member.id,
      accountId: created.id,
      deskType: choice.deskType,
      connectionId,
      venue: created.venue,
      venueEnvironment: created.venueEnvironment,
    });
    if (bound.error) {
      return fail(bound.error);
    }
  }
  await writeEventLog({
    scope: "system",
    event: "account.created",
    message: `Created ${choice.mode} desk ${named.name}`,
    userId: member.id,
    accountId: created.id,
    data: {
      mode: choice.mode,
      name: named.name,
      deskType: choice.deskType,
      venue: choice.venue,
      venueEnvironment,
      ...(connectionId ? { exchangeConnectionId: connectionId } : {}),
    },
  });
  if (switchToNew) {
    await setActiveAccountId(created.id);
  }
  refreshAccountChrome();
  if (staysOnManagePage(next) && !firstDesk) {
    redirect(`${SUB_ACCOUNTS_PATH}?created=1`);
  }
  if (switchToNew) {
    redirect(deskHomePath(created.deskType, created.id));
  }
  const session = await getSessionContext();
  redirect(
    safeStayPath(formData.get("stayPath")) ??
      (session
        ? deskHomePath(session.account.deskType, session.account.id)
        : deskHomePath(created.deskType, created.id)),
  );
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

export async function readDeskNameFromSettingsForm(args: {
  formData: FormData;
  userId: string;
  accountId: string;
  currentName: string;
}): Promise<
  | { ok: true; name: string; changed: boolean }
  | { ok: false; error: string }
> {
  const raw = args.formData.get("name");
  if (raw === null) {
    return { ok: true, name: args.currentName, changed: false };
  }
  const accounts = await listTradingAccounts(args.userId);
  return parseDeskNameChange(
    raw,
    otherDeskNames(accounts, args.accountId),
    args.currentName,
  );
}

export async function commitDeskRename(args: {
  userId: string;
  accountId: string;
  name: string;
}): Promise<{ error: string | null }> {
  const written = await renameTradingAccountRow(
    args.userId,
    args.accountId,
    args.name,
  );
  if (written.error) {
    return {
      error:
        written.error === "That name is already in use."
          ? DESK_NAME_TAKEN
          : written.error,
    };
  }
  await writeEventLog({
    scope: "system",
    event: "account.renamed",
    message: `Renamed account to ${args.name}`,
    userId: args.userId,
    accountId: args.accountId,
    data: { name: args.name },
  });
  refreshAccountChrome();
  return { error: null };
}

export async function renameTradingAccount(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const accountId = String(formData.get("accountId") ?? "");
  const accounts = await listTradingAccounts(session.member.id);
  const target = accounts.find((account) => account.id === accountId);
  if (!target) {
    redirect(
      `${SUB_ACCOUNTS_PATH}?error=${encodeURIComponent("That account was not found.")}`,
    );
  }
  const named = validateNewDeskName(
    formData.get("name"),
    otherDeskNames(accounts, accountId),
  );
  if (!named.ok) {
    redirect(`${SUB_ACCOUNTS_PATH}?error=${encodeURIComponent(named.error)}`);
  }
  if (target.name === named.name) {
    redirect(SUB_ACCOUNTS_PATH);
  }
  const written = await commitDeskRename({
    userId: session.member.id,
    accountId,
    name: named.name,
  });
  if (written.error) {
    redirect(`${SUB_ACCOUNTS_PATH}?error=${encodeURIComponent(written.error)}`);
  }
  redirect(`${SUB_ACCOUNTS_PATH}?renamed=1`);
}
