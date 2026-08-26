import {
  getVenue,
  type VenueDefinition,
} from "@/lib/exchanges/venues";

export type ExchangeConnection = {
  id: string;
  userId: string;
  venue: string;
  environment: string;
  label: string | null;
  fingerprint: string;
  status: "active" | "invalid";
  verifiedAtMs: number | null;
  createdAtMs: number;
};

export function parseBoundConnectionId(raw: unknown): string | null {
  const id = String(raw ?? "").trim();
  if (!id || id === "none") {
    return null;
  }
  return id;
}

export function formatDeskBindLabel(input: {
  accountName: string;
  strategy: "cash_and_carry" | "futures";
}): string {
  const strategy =
    input.strategy === "futures" ? "Futures" : "Cash and Carry";
  return `${input.accountName} · ${strategy}`;
}

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

export function formatConnectionSummary(row: ExchangeConnection): string {
  const venue = formatVenueLabel(row.venue);
  const environment = formatEnvironmentLabel(row.venue, row.environment);
  const named = row.label ? `${row.label} · ` : "";
  return `${venue} ${environment} · ${named}••••${row.fingerprint}`;
}

export function formatStrategyConnectionCaption(row: ExchangeConnection): {
  name: string;
  venue: string | null;
} {
  const venue = formatVenueLabel(row.venue);
  const named = row.label?.trim() || null;
  return named ? { name: named, venue } : { name: venue, venue: null };
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
    venue?.environments.find(
      (item) => item.id === environmentId || item.aliases?.includes(environmentId),
    )?.label ?? environmentId
  );
}

export function parseExchangeConnectionRow(
  row: Record<string, unknown>,
): ExchangeConnection | null {
  const id = String(row.id ?? "");
  const userId = String(row.user_id ?? "");
  const venue = String(row.venue ?? "");
  const environment = String(row.environment ?? "");
  const fingerprint = String(row.key_fingerprint ?? "");
  const status = row.status === "invalid" ? "invalid" : "active";
  if (!id || !userId || !venue || !environment || fingerprint.length < 4) {
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
    userId,
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

export function fromByteaParam(value: unknown): Buffer | null {
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  const hex = raw.startsWith("\\x") ? raw.slice(2) : raw;
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }
  return Buffer.from(hex, "hex");
}
