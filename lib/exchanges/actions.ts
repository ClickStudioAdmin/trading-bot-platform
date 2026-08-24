"use server";

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
  insertExchangeConnection,
} from "@/lib/exchanges/store";
import {
  accountCanHoldConnections,
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
  if (!accountCanHoldConnections(session.account.mode)) {
    fail("Switch to a Live account to connect an exchange.");
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

  let packed;
  try {
    packed = encryptCredentials(parsed.credentials);
  } catch {
    fail("Could not encrypt those credentials.");
  }

  const written = await insertExchangeConnection({
    userId: session.member.id,
    accountId: session.account.id,
    venue: venue.venue.id,
    environment: environment.environment.id,
    label: labeled.label,
    fingerprint,
    ciphertext: packed.ciphertext,
    nonce: packed.nonce,
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
  redirect("/account/exchanges?saved=1");
}

export async function removeExchangeConnection(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  if (!accountCanHoldConnections(session.account.mode)) {
    fail("Switch to a Live account to manage exchange connections.");
  }
  const connectionId = String(formData.get("connectionId") ?? "");
  if (!connectionId) {
    fail("Missing connection.");
  }
  const written = await deleteExchangeConnection({
    userId: session.member.id,
    accountId: session.account.id,
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
  redirect("/account/exchanges?removed=1");
}
