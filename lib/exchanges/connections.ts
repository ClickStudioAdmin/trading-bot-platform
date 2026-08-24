import {
  getVenue,
  type VenueDefinition,
} from "@/lib/exchanges/venues";

export type ExchangeConnection = {
  id: string;
  accountId: string;
  venue: string;
  environment: string;
  label: string | null;
  fingerprint: string;
  status: "active" | "invalid";
  verifiedAtMs: number | null;
  createdAtMs: number;
};

export function parseConnectionLabel(
  raw: unknown,
): { ok: true; label: string | null } | { ok: false; error: string } {
  const label = String(raw ?? "").trim();
  if (label === "") {
    return { ok: true, label: null };
  }
  if (label.length > 40) {
    return { ok: false, error: "Label must be 40 characters or fewer." };
  }
  return { ok: true, label };
}

export function keyFingerprint(
  credentials: Record<string, string>,
  venue: VenueDefinition,
): string | null {
  const field =
    venue.credentialFields.find((item) => !item.secret) ??
    venue.credentialFields[0];
  if (!field) {
    return null;
  }
  const value = credentials[field.key] ?? "";
  if (value.length < 4) {
    return null;
  }
  return value.slice(-4);
}

export function formatVenueLabel(venueId: string): string {
  return getVenue(venueId)?.label ?? venueId;
}

export function formatEnvironmentLabel(
  venueId: string,
  environmentId: string,
): string {
  const venue = getVenue(venueId);
  return (
    venue?.environments.find((item) => item.id === environmentId)?.label ??
    environmentId
  );
}

export function parseExchangeConnectionRow(
  row: Record<string, unknown>,
): ExchangeConnection | null {
  const id = String(row.id ?? "");
  const accountId = String(row.account_id ?? "");
  const venue = String(row.venue ?? "");
  const environment = String(row.environment ?? "");
  const fingerprint = String(row.key_fingerprint ?? "");
  const status = row.status === "invalid" ? "invalid" : "active";
  if (!id || !accountId || !venue || !environment || fingerprint.length < 4) {
    return null;
  }
  const created = new Date(String(row.created_at ?? "")).getTime();
  const verified = row.verified_at
    ? new Date(String(row.verified_at)).getTime()
    : null;
  const labelRaw = row.label;
  const label =
    labelRaw === null || labelRaw === undefined
      ? null
      : String(labelRaw).trim() || null;
  return {
    id,
    accountId,
    venue,
    environment,
    label,
    fingerprint,
    status,
    verifiedAtMs: verified && Number.isFinite(verified) ? verified : null,
    createdAtMs: Number.isFinite(created) ? created : 0,
  };
}

export function toByteaParam(value: Buffer): string {
  return `\\x${value.toString("hex")}`;
}
