"use server";

import { closeTradingAccountRow } from "@/lib/accounts/close-store";
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
  withQuery,
} from "@/lib/accounts/model";
import { parseBoundConnectionId } from "@/lib/exchanges/connections";
import { listExchangeConnections } from "@/lib/exchanges/store";
import {
  connectionFitsDesk,
  parseStoredVenueEnvironment,
} from "@/lib/exchanges/venues";
import { writeEventLog } from "@/lib/logs/write";
import { deniedDeskTypeMessage } from "@/lib/membership/entitlements";
import { loadDeskTypeAccess } from "@/lib/membership/load-desk-type-access";
import {
  deniedDeskQuotaMessage,
  deniedQuotaMessage,
} from "@/lib/membership/load-quota-access";
import { listOnboardingFolders } from "@/lib/onboarding/catalog";
import { starterTemplateAllowed } from "@/lib/onboarding/model";
import { skipOnboardingForExternalDesk } from "@/lib/onboarding/store";
import { applyTemplateToDesk } from "@/lib/templates/apply";
import { DESK_DELETE_TIMED_OUT } from "@/lib/accounts/desk-delete";
import {
  DESK_DELETE_GRANT_COOKIE,
  DESK_DELETE_GRANT_MS,
  deskDeleteGrantAllows,
  signDeskDeleteGrant,
} from "@/lib/accounts/desk-delete-grant";
import { stepUpFromForm } from "@/lib/auth/step-up-guard";
import { stepUpRejection } from "@/lib/auth/step-up";
import {
  getSessionContext,
  requireVerifiedEmail,
  setActiveAccountId,
} from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SUB_ACCOUNTS_PATH = "/account/sub-accounts";

function createDeskErrorPath(
  formData: FormData,
  message: string,
): string {
  const next = String(formData.get("next") ?? "");
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


export async function rememberTradingAccount(accountId: string) {
  const user = await requireVerifiedEmail();
  const accounts = await listTradingAccounts(user.id);
  const match = accounts.find((account) => account.id === accountId);
  if (!match) {
    return;
  }
  await setActiveAccountId(match.id);
}

export async function switchTradingAccount(formData: FormData) {
  const user = await requireVerifiedEmail();
  const accountId = String(formData.get("accountId") ?? "");
  const accounts = await listTradingAccounts(user.id);
  const match = accounts.find((account) => account.id === accountId);
  if (!match) {
    redirect("/strategies");
  }
  await setActiveAccountId(match.id);
  refreshAccountChrome();
  const next = accountReturnPath(String(formData.get("next") ?? ""));
  redirect(next ?? deskHomePath(match, match.id));
}

export async function createTradingAccount(formData: FormData) {
  const member = await requireVerifiedEmail();
  const desks = await listTradingAccounts(member.id);
  const fail = (message: string): never =>
    redirect(createDeskErrorPath(formData, message));
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
  const typeDenied = deniedDeskTypeMessage(
    await loadDeskTypeAccess(member.id),
    choice.deskType,
  );
  if (typeDenied) {
    return fail(typeDenied);
  }
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
  const quotaDenied = await deniedDeskQuotaMessage(member.id, {
    mode: choice.mode,
    venueEnvironment,
  });
  if (quotaDenied) {
    return fail(quotaDenied);
  }
  const starterIds = [
    ...new Set(
      formData
        .getAll("starterTemplateId")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];
  if (starterIds.length > 0) {
    const botDenied = await deniedQuotaMessage(
      member.id,
      "max_bots",
      starterIds.length,
    );
    if (botDenied) {
      return fail(botDenied);
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
  const starterErrors: string[] = [];
  if (starterIds.length > 0) {
    const folders = await listOnboardingFolders();
    for (const templateId of starterIds) {
      if (
        !starterTemplateAllowed({
          folders,
          deskType: choice.deskType,
          templateId,
        })
      ) {
        starterErrors.push("That starter bot is not available.");
        continue;
      }
      const applied = await applyTemplateToDesk({
        userId: member.id,
        accountId: created.id,
        templateId,
      });
      if (!applied.ok) {
        starterErrors.push(applied.error ?? "Could not load that bot.");
      }
    }
  }
  await skipOnboardingForExternalDesk(member.id);
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
  await setActiveAccountId(created.id);
  refreshAccountChrome();
  const home = deskHomePath(created.deskType, created.id);
  redirect(
    starterErrors.length > 0
      ? withQuery(home, { error: [...new Set(starterErrors)].join(" ") })
      : home,
  );
}

async function deskDeleteGrantToken(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(DESK_DELETE_GRANT_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

async function rememberDeskDeleteGrant(
  userId: string,
  accountId: string,
): Promise<void> {
  const expiresAtMs = Date.now() + DESK_DELETE_GRANT_MS;
  const store = await cookies();
  store.set(
    DESK_DELETE_GRANT_COOKIE,
    signDeskDeleteGrant(userId, accountId, expiresAtMs),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(expiresAtMs),
    },
  );
}

async function clearDeskDeleteGrant(): Promise<void> {
  try {
    const store = await cookies();
    store.delete(DESK_DELETE_GRANT_COOKIE);
  } catch {
    // The delete result still stands when the cookie store is unavailable.
  }
}

export async function deleteTradingAccount(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const accountId = String(formData.get("accountId") ?? "");
  const granted =
    deskDeleteGrantAllows(
      String(formData.get("deskDeleteGrant") ?? ""),
      session.member.id,
      accountId,
    ) ||
    deskDeleteGrantAllows(
      await deskDeleteGrantToken(),
      session.member.id,
      accountId,
    );
  if (!granted) {
    const stepUp = await stepUpFromForm(session.member.id, formData);
    if (stepUp) {
      return stepUpRejection(stepUp);
    }
  }
  try {
    await rememberDeskDeleteGrant(session.member.id, accountId);
  } catch {
    // One pass still runs. A follow-up pass asks for a new code.
  }
  const written = await deleteTradingAccountRow(session.member.id, accountId);
  if (written.error) {
    if (written.error !== DESK_DELETE_TIMED_OUT) {
      await clearDeskDeleteGrant();
      return stepUpRejection(written.error);
    }
    const expiresAtMs = Date.now() + DESK_DELETE_GRANT_MS;
    return {
      ...stepUpRejection(written.error),
      deskDeleteGrant: signDeskDeleteGrant(
        session.member.id,
        accountId,
        expiresAtMs,
      ),
    };
  }
  await clearDeskDeleteGrant();
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

export async function closeTradingAccount(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const accountId = String(formData.get("accountId") ?? "");
  const granted =
    deskDeleteGrantAllows(
      String(formData.get("deskDeleteGrant") ?? ""),
      session.member.id,
      accountId,
    ) ||
    deskDeleteGrantAllows(
      await deskDeleteGrantToken(),
      session.member.id,
      accountId,
    );
  if (!granted) {
    const stepUp = await stepUpFromForm(session.member.id, formData);
    if (stepUp) {
      return stepUpRejection(stepUp);
    }
  }
  try {
    await rememberDeskDeleteGrant(session.member.id, accountId);
  } catch {
    // One pass still runs. A follow-up pass asks for a new code.
  }
  const written = await closeTradingAccountRow(session.member.id, accountId);
  if (written.error) {
    if (written.error !== DESK_DELETE_TIMED_OUT) {
      await clearDeskDeleteGrant();
      return stepUpRejection(written.error);
    }
    const expiresAtMs = Date.now() + DESK_DELETE_GRANT_MS;
    return {
      ...stepUpRejection(written.error),
      deskDeleteGrant: signDeskDeleteGrant(
        session.member.id,
        accountId,
        expiresAtMs,
      ),
    };
  }
  await clearDeskDeleteGrant();
  await writeEventLog({
    scope: "system",
    event: "copy.desk_closed",
    message:
      written.kind === "archive"
        ? "Closed a desk. Followers keep their copy for six months."
        : "Closed a desk and withdrew the invites.",
    userId: session.member.id,
    data: { accountId, kind: written.kind },
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
  redirect(
    `${SUB_ACCOUNTS_PATH}?closed=${written.kind === "archive" ? "archive" : "revoke"}`,
  );
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
