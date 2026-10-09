import {
  keyFingerprint,
  parseConnectionLabel,
} from "@/lib/exchanges/connections";
import {
  encryptCredentials,
  exchangeCredentialsConfigured,
} from "@/lib/exchanges/encrypt";
import {
  findExchangeConnectionByVenueAccount,
  insertExchangeConnection,
} from "@/lib/exchanges/store";
import { exclusiveVenueAccountError } from "@/lib/exchanges/venue-account";
import { verifyExchangeCredentials } from "@/lib/exchanges/verify";
import {
  parseConnectionVenueId,
  parseVenueCredentials,
  parseVenueEnvironment,
  type VenueDefinition,
} from "@/lib/exchanges/venues";

export type SavedMemberConnection = {
  id: string;
  venue: string;
  environment: string;
  label: string | null;
  fingerprint: string;
  status: "active";
};

export function readConnectForm(formData: FormData):
  | {
      ok: true;
      venue: VenueDefinition;
      environment: { id: string; label: string };
      label: string | null;
      credentials: Record<string, string>;
      fingerprint: string;
    }
  | { ok: false; error: string } {
  const venue = parseConnectionVenueId(formData.get("venue"));
  if (!venue.ok) {
    return venue;
  }
  const environment = parseVenueEnvironment(
    venue.venue,
    formData.get("environment"),
  );
  if (!environment.ok) {
    return environment;
  }
  const labeled = parseConnectionLabel(formData.get("label"));
  if (!labeled.ok) {
    return labeled;
  }
  const credentials: Record<string, string> = {};
  for (const field of venue.venue.credentialFields) {
    credentials[field.key] = String(formData.get(field.key) ?? "");
  }
  const parsed = parseVenueCredentials(venue.venue, credentials);
  if (!parsed.ok) {
    return parsed;
  }
  const fingerprint = keyFingerprint(parsed.credentials, venue.venue);
  if (!fingerprint) {
    return {
      ok: false,
      error:
        venue.venue.id === "hyperliquid"
          ? "Agent private key is not a valid key."
          : "API key is too short to save.",
    };
  }
  return {
    ok: true,
    venue: venue.venue,
    environment: environment.environment,
    label: labeled.label,
    credentials: parsed.credentials,
    fingerprint,
  };
}

export async function rejectTakenVenueAccount(input: {
  userId: string;
  venueId: string;
  environment: string;
  venueAccountId: string;
  exceptConnectionId?: string;
}): Promise<string | null> {
  const existing = await findExchangeConnectionByVenueAccount({
    userId: input.userId,
    venue: input.venueId,
    environment: input.environment,
    venueAccountId: input.venueAccountId,
    exceptConnectionId: input.exceptConnectionId,
  });
  return exclusiveVenueAccountError({
    venueId: input.venueId,
    existing,
  });
}

export async function createMemberExchangeConnection(input: {
  userId: string;
  formData: FormData;
}): Promise<
  { ok: true; connection: SavedMemberConnection } | { ok: false; error: string }
> {
  if (!exchangeCredentialsConfigured()) {
    return {
      ok: false,
      error: "Exchange credentials key is not configured on this environment.",
    };
  }
  const parsed = readConnectForm(input.formData);
  if (!parsed.ok) {
    return parsed;
  }
  const verified = await verifyExchangeCredentials({
    venueId: parsed.venue.id,
    environmentId: parsed.environment.id,
    credentials: parsed.credentials,
  });
  if (!verified.ok) {
    return verified;
  }
  const taken = await rejectTakenVenueAccount({
    userId: input.userId,
    venueId: parsed.venue.id,
    environment: parsed.environment.id,
    venueAccountId: verified.venueAccountId,
  });
  if (taken) {
    return { ok: false, error: taken };
  }
  let packed;
  try {
    packed = encryptCredentials(parsed.credentials);
  } catch {
    return { ok: false, error: "Could not encrypt those credentials." };
  }
  const written = await insertExchangeConnection({
    userId: input.userId,
    venue: parsed.venue.id,
    environment: parsed.environment.id,
    label: parsed.label,
    fingerprint: parsed.fingerprint,
    venueAccountId: verified.venueAccountId,
    ciphertext: packed.ciphertext,
    nonce: packed.nonce,
    verifiedAt: new Date().toISOString(),
  });
  if ("error" in written) {
    return { ok: false, error: written.error };
  }
  return {
    ok: true,
    connection: {
      id: written.id,
      venue: parsed.venue.id,
      environment: parsed.environment.id,
      label: parsed.label,
      fingerprint: parsed.fingerprint,
      status: "active",
    },
  };
}
