"use server";

import { closeTradingAccountRow } from "@/lib/accounts/close-store";
import {
  bulkDeskDeleteBlockReason,
  parseBulkDeskIds,
  pickBulkDeleteSwitch,
} from "@/lib/accounts/desk-bulk";
import {
  bindConnectionToDesk,
  deleteTradingAccountRow,
  insertTradingAccount,
  listTradingAccounts,
  loadAccountUsage,
  renameTradingAccountRow,
} from "@/lib/accounts/store";
import {
  deskCreatedPath,
  parseDeskCreateChoice,
  parseDeskCreateOrigin,
  pickSwitchAfterDelete,
  deskHomePath,
  validateNewDeskName,
  DESK_NAME_TAKEN,
  otherDeskNames,
  parseDeskNameChange,
  withQuery,
} from "@/lib/accounts/model";
import { exchangePreviewForLogin } from "@/lib/admin/emails";
import { exchangeCreateAllowed } from "@/lib/exchanges/availability";
import { loadExchangeAvailability } from "@/lib/exchanges/availability-store";
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
import {
  DESK_DELETE_FAILED,
  DESK_DELETE_TIMED_OUT,
} from "@/lib/accounts/desk-delete";
import {
  DESK_DELETE_GRANT_COOKIE,
  DESK_DELETE_GRANT_MS,
  bulkDeskDeleteGrantAllows,
  deskDeleteGrantAllows,
  parseBulkDeskDeleteGrant,
  signBulkDeskDeleteGrant,
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
    const origin = parseDeskCreateOrigin(formData.get("createFrom"));
    if (origin) {
      params.set("from", origin);
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
  const [desks, exchangeCells] = await Promise.all([
    listTradingAccounts(member.id),
    loadExchangeAvailability(),
  ]);
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
  const exchangeAllowed = exchangeCreateAllowed({
    cells: exchangeCells,
    preview: exchangePreviewForLogin(member),
    deskType: choice.deskType,
    venueId: choice.venue,
    accountMode: choice.mode,
    environmentId: choice.mode === "live" ? venueEnvironment : null,
  });
  if (!exchangeAllowed.ok) {
    return fail(exchangeAllowed.error);
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
  const starterError =
    starterErrors.length > 0 ? [...new Set(starterErrors)].join(" ") : "";
  const origin = parseDeskCreateOrigin(formData.get("createFrom"));
  if (origin) {
    redirect(
      deskCreatedPath({
        deskType: created.deskType,
        origin,
        accountId: created.id,
        error: starterError,
      }),
    );
  }
  const home = deskHomePath(created.deskType, created.id);
  redirect(starterError ? withQuery(home, { error: starterError }) : home);
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
  await rememberDeskDeleteGrantToken(
    signDeskDeleteGrant(userId, accountId, expiresAtMs),
    expiresAtMs,
  );
}

async function rememberDeskDeleteGrantToken(
  token: string,
  expiresAtMs: number,
): Promise<void> {
  if (token.length > 3500) {
    return;
  }
  const store = await cookies();
  store.set(DESK_DELETE_GRANT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAtMs),
  });
}

async function bulkDeletePreflight(
  userId: string,
  bulkIds: readonly string[],
): Promise<string | null> {
  const accounts = await listTradingAccounts(userId);
  const usage = await loadAccountUsage(accounts);
  const owned = new Set(accounts.map((account) => account.id));
  return bulkDeskDeleteBlockReason(
    bulkIds.map((id) => {
      const account = accounts.find((row) => row.id === id);
      const row = usage.get(id);
      return {
        name: account?.name ?? "Desk",
        found: owned.has(id),
        blocks: row?.blocks ?? (owned.has(id) ? ["last"] : []),
        closeKind: row?.closeKind ?? null,
      };
    }),
    accounts.length,
  );
}

function presentedBulkGrant(
  presented: string,
  cookieToken: string | null,
  userId: string,
  accountId: string,
): string {
  if (bulkDeskDeleteGrantAllows(presented, userId, accountId)) {
    return presented;
  }
  if (bulkDeskDeleteGrantAllows(cookieToken, userId, accountId)) {
    return cookieToken ?? "";
  }
  return "";
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

/** One desk from a bulk delete. The caller repeats this for the rest of the selection. */
export async function deleteTradingAccountForBulk(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    return stepUpRejection("Sign in to continue.");
  }
  const userId = session.member.id;
  const accountId = String(formData.get("accountId") ?? "").trim();
  const bulkIds = parseBulkDeskIds(formData.getAll("bulkAccountId"));
  if (!accountId || !bulkIds.includes(accountId)) {
    return stepUpRejection("That desk was not found.");
  }
  let signed = presentedBulkGrant(
    String(formData.get("deskDeleteGrant") ?? ""),
    await deskDeleteGrantToken(),
    userId,
    accountId,
  );
  if (!signed) {
    const reason = await bulkDeletePreflight(userId, bulkIds);
    if (reason) {
      return stepUpRejection(reason);
    }
    const stepUp = await stepUpFromForm(userId, formData);
    if (stepUp) {
      return stepUpRejection(stepUp);
    }
    const expiresAtMs = Date.now() + DESK_DELETE_GRANT_MS;
    try {
      signed = signBulkDeskDeleteGrant(userId, bulkIds, expiresAtMs) ?? "";
    } catch {
      return stepUpRejection(DESK_DELETE_FAILED);
    }
    if (!signed) {
      return stepUpRejection(DESK_DELETE_FAILED);
    }
  }
  const expiresAtMs =
    parseBulkDeskDeleteGrant(signed)?.expiresAtMs ??
    Date.now() + DESK_DELETE_GRANT_MS;
  try {
    await rememberDeskDeleteGrantToken(signed, expiresAtMs);
  } catch {
    // The returned grant still covers the rest of this batch.
  }
  const written = await deleteTradingAccountRow(userId, accountId);
  if (written.error) {
    if (written.error !== DESK_DELETE_TIMED_OUT) {
      await clearDeskDeleteGrant();
      return stepUpRejection(written.error);
    }
    return {
      ...stepUpRejection(written.error),
      deskDeleteGrant: signed,
    };
  }
  await writeEventLog({
    scope: "system",
    event: "account.deleted",
    message: "Deleted a trading account",
    userId,
    data: { accountId, bulk: true },
  });
  if (session.account.id === accountId) {
    const remaining = await listTradingAccounts(userId);
    const next = pickBulkDeleteSwitch(
      remaining,
      bulkIds,
      formData.get("switchToAccountId"),
    );
    if (next) {
      await setActiveAccountId(next.id);
    }
  }
  if (String(formData.get("bulkLast") ?? "") === "1") {
    await clearDeskDeleteGrant();
  }
  refreshAccountChrome();
  return { deskDeleteGrant: signed };
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
