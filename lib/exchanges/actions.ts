"use server";

import {
  connectionRemoveBlockers,
  formatConnectionRemoveBlockers,
} from "@/lib/accounts/model";
import {
  keyFingerprint,
  parseConnectionLabel,
} from "@/lib/exchanges/connections";
import {
  exchangeCredentialsConfigured,
  encryptCredentials,
} from "@/lib/exchanges/encrypt";
import {
  deleteExchangeConnection,
  getExchangeConnectionForUser,
  insertExchangeConnection,
  listConnectionDeskBinds,
  updateExchangeConnectionCredentials,
} from "@/lib/exchanges/store";
import { verifyExchangeCredentials } from "@/lib/exchanges/verify";
import {
  parseVenueCredentials,
  parseVenueEnvironment,
  parseVenueId,
} from "@/lib/exchanges/venues";
import { writeEventLog } from "@/lib/logs/write";
import { getSessionContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function fail(message: string): never {
  redirect(`/account/exchanges?error=${encodeURIComponent(message)}`);
}

export async function saveExchangeConnection(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  if (!exchangeCredentialsConfigured()) {
    fail("Exchange credentials key is not configured on this environment.");
  }

  const venue = parseVenueId(formData.get("venue"));
  if (!venue.ok) {
    fail(venue.error);
  }
  const environment = parseVenueEnvironment(
    venue.venue,
    formData.get("environment"),
  );
  if (!environment.ok) {
    fail(environment.error);
  }
  const labeled = parseConnectionLabel(formData.get("label"));
  if (!labeled.ok) {
    fail(labeled.error);
  }
  const credentials: Record<string, string> = {};
  for (const field of venue.venue.credentialFields) {
    credentials[field.key] = String(formData.get(field.key) ?? "");
  }
  const parsed = parseVenueCredentials(venue.venue, credentials);
  if (!parsed.ok) {
    fail(parsed.error);
  }
  const fingerprint = keyFingerprint(parsed.credentials, venue.venue);
  if (!fingerprint) {
    fail("API key is too short to save.");
  }

  const verified = await verifyExchangeCredentials({
    venueId: venue.venue.id,
    environmentId: environment.environment.id,
    credentials: parsed.credentials,
  });
  if (!verified.ok) {
    await writeEventLog({
      level: "error",
      scope: "system",
      event: "exchange.verify_failed",
      message: verified.error,
      userId: session.member.id,
      accountId: session.account.id,
      data: {
        venue: venue.venue.id,
        environment: environment.environment.id,
        fingerprint,
        reason: verified.error,
      },
    });
    fail(verified.error);
  }

  let packed;
  try {
    packed = encryptCredentials(parsed.credentials);
  } catch {
    fail("Could not encrypt those credentials.");
  }

  const written = await insertExchangeConnection({
    userId: session.member.id,
    venue: venue.venue.id,
    environment: environment.environment.id,
    label: labeled.label,
    fingerprint,
    ciphertext: packed.ciphertext,
    nonce: packed.nonce,
    verifiedAt: new Date().toISOString(),
  });
  if ("error" in written) {
    await writeEventLog({
      level: "error",
      scope: "system",
      event: "exchange.save_failed",
      message: written.error,
      userId: session.member.id,
      accountId: session.account.id,
      data: {
        venue: venue.venue.id,
        environment: environment.environment.id,
        fingerprint,
      },
    });
    fail(written.error);
  }

  await writeEventLog({
    scope: "system",
    event: "exchange.saved",
    message: `Connected ${venue.venue.label} ${environment.environment.label}`,
    userId: session.member.id,
    accountId: session.account.id,
    data: {
      venue: venue.venue.id,
      environment: environment.environment.id,
      fingerprint,
    },
  });
  revalidatePath("/account/exchanges");
  revalidatePath("/account");
  revalidatePath("/account/book");
  revalidatePath("/account/sub-accounts");
  redirect("/account/exchanges?saved=1");
}

export async function replaceExchangeConnection(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  if (!exchangeCredentialsConfigured()) {
    fail("Exchange credentials key is not configured on this environment.");
  }

  const connectionId = String(formData.get("connectionId") ?? "").trim();
  if (!connectionId) {
    fail("Missing connection.");
  }
  const existing = await getExchangeConnectionForUser({
    userId: session.member.id,
    connectionId,
  });
  if (!existing) {
    fail("Missing connection.");
  }

  const venue = parseVenueId(existing.venue);
  if (!venue.ok) {
    fail(venue.error);
  }
  const environment = parseVenueEnvironment(
    venue.venue,
    existing.environment,
  );
  if (!environment.ok) {
    fail(environment.error);
  }
  const credentials: Record<string, string> = {};
  for (const field of venue.venue.credentialFields) {
    credentials[field.key] = String(formData.get(field.key) ?? "");
  }
  const parsed = parseVenueCredentials(venue.venue, credentials);
  if (!parsed.ok) {
    fail(parsed.error);
  }
  const fingerprint = keyFingerprint(parsed.credentials, venue.venue);
  if (!fingerprint) {
    fail("API key is too short to save.");
  }

  const verified = await verifyExchangeCredentials({
    venueId: venue.venue.id,
    environmentId: environment.environment.id,
    credentials: parsed.credentials,
  });
  if (!verified.ok) {
    await writeEventLog({
      level: "error",
      scope: "system",
      event: "exchange.verify_failed",
      message: verified.error,
      userId: session.member.id,
      accountId: session.account.id,
      data: {
        connectionId,
        venue: venue.venue.id,
        environment: existing.environment,
        fingerprint,
        reason: verified.error,
      },
    });
    fail(verified.error);
  }

  let packed;
  try {
    packed = encryptCredentials(parsed.credentials);
  } catch {
    fail("Could not encrypt those credentials.");
  }

  const written = await updateExchangeConnectionCredentials({
    userId: session.member.id,
    connectionId,
    fingerprint,
    ciphertext: packed.ciphertext,
    nonce: packed.nonce,
    verifiedAt: new Date().toISOString(),
  });
  if (written.error) {
    await writeEventLog({
      level: "error",
      scope: "system",
      event: "exchange.replace_failed",
      message: written.error,
      userId: session.member.id,
      accountId: session.account.id,
      data: {
        connectionId,
        venue: venue.venue.id,
        environment: existing.environment,
        fingerprint,
      },
    });
    fail(written.error);
  }

  await writeEventLog({
    scope: "system",
    event: "exchange.replaced",
    message: `Replaced ${venue.venue.label} key`,
    userId: session.member.id,
    accountId: session.account.id,
    data: {
      connectionId,
      venue: venue.venue.id,
      environment: existing.environment,
      fingerprint,
    },
  });
  revalidatePath("/account/exchanges");
  revalidatePath("/account");
  revalidatePath("/account/book");
  revalidatePath("/account/sub-accounts");
  revalidatePath("/strategies/cash-and-carry");
  revalidatePath("/strategies/cash-and-carry/settings");
  revalidatePath("/strategies/futures");
  revalidatePath("/strategies/futures/settings");
  redirect("/account/exchanges?replaced=1");
}

export async function removeExchangeConnection(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const connectionId = String(formData.get("connectionId") ?? "");
  if (!connectionId) {
    fail("Missing connection.");
  }
  const binds = await listConnectionDeskBinds(session.member.id);
  const inUse = binds.some((bind) => bind.connectionId === connectionId);
  const blocks = connectionRemoveBlockers({ inUse });
  if (blocks.length > 0) {
    fail(formatConnectionRemoveBlockers(blocks));
  }
  const written = await deleteExchangeConnection({
    userId: session.member.id,
    connectionId,
  });
  if (written.error) {
    await writeEventLog({
      level: "error",
      scope: "system",
      event: "exchange.remove_failed",
      message: written.error,
      userId: session.member.id,
      accountId: session.account.id,
      data: { connectionId },
    });
    fail(written.error);
  }
  await writeEventLog({
    scope: "system",
    event: "exchange.removed",
    message: "Removed an exchange connection",
    userId: session.member.id,
    accountId: session.account.id,
    data: { connectionId },
  });
  revalidatePath("/account/exchanges");
  revalidatePath("/account");
  revalidatePath("/account/book");
  revalidatePath("/account/sub-accounts");
  revalidatePath("/strategies/cash-and-carry");
  revalidatePath("/strategies/cash-and-carry/settings");
  revalidatePath("/strategies/futures");
  revalidatePath("/strategies/futures/settings");
  redirect("/account/exchanges?removed=1");
}
