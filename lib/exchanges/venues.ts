export type VenueCredentialField = {
  key: string;
  label: string;
  secret: boolean;
};

export type VenueEnvironment = {
  id: string;
  label: string;
};

export type VenueDefinition = {
  id: string;
  label: string;
  enabled: boolean;
  environments: readonly VenueEnvironment[];
  credentialFields: readonly VenueCredentialField[];
};

export const VENUES: readonly VenueDefinition[] = [
  {
    id: "bybit",
    label: "Bybit",
    enabled: true,
    environments: [
      { id: "mainnet", label: "Mainnet" },
      { id: "demo", label: "Demo" },
    ],
    credentialFields: [
      { key: "apiKey", label: "API key", secret: false },
      { key: "apiSecret", label: "API secret", secret: true },
    ],
  },
];

export function enabledVenues(): VenueDefinition[] {
  return VENUES.filter((venue) => venue.enabled);
}

export function getVenue(id: string): VenueDefinition | null {
  return VENUES.find((venue) => venue.id === id) ?? null;
}

export function parseVenueId(
  raw: unknown,
): { ok: true; venue: VenueDefinition } | { ok: false; error: string } {
  const id = String(raw ?? "").trim();
  const venue = getVenue(id);
  if (!venue) {
    return { ok: false, error: "Unknown exchange." };
  }
  if (!venue.enabled) {
    return { ok: false, error: "That exchange is not available yet." };
  }
  return { ok: true, venue };
}

export function parseVenueEnvironment(
  venue: VenueDefinition,
  raw: unknown,
): { ok: true; environment: VenueEnvironment } | { ok: false; error: string } {
  const id = String(raw ?? "").trim();
  const environment = venue.environments.find((item) => item.id === id);
  if (!environment) {
    return { ok: false, error: "Unknown environment for that exchange." };
  }
  return { ok: true, environment };
}

export function parseVenueCredentials(
  venue: VenueDefinition,
  raw: unknown,
):
  | { ok: true; credentials: Record<string, string> }
  | { ok: false; error: string } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Enter the API credentials." };
  }
  const input = raw as Record<string, unknown>;
  const credentials: Record<string, string> = {};
  for (const field of venue.credentialFields) {
    const value = String(input[field.key] ?? "").trim();
    if (value === "") {
      return { ok: false, error: `${field.label} is required.` };
    }
    credentials[field.key] = value;
  }
  return { ok: true, credentials };
}

export function accountCanHoldConnections(mode: string): boolean {
  return mode === "live";
}
