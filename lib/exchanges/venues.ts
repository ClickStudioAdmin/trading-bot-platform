export type VenueDeskType =
  | "cash_and_carry"
  | "perps"
  | "signal_follower"
  | "dca";

export type VenuePositionMode = "hedge" | "one_way";
export type VenueQuote = "USDT" | "USDC";
export type VenueSymbolKind = "linear_usdt" | "coin";

export type VenueCredentialField = {
  key: string;
  label: string;
  secret: boolean;
};

export type VenueEnvironment = {
  id: string;
  label: string;
  aliases?: readonly string[];
  host?: string;
};

export type VenueDefinition = {
  id: string;
  label: string;
  enabled: boolean;
  connectionsEnabled: boolean;
  deskTypes: readonly VenueDeskType[];
  positionMode: VenuePositionMode;
  quote: VenueQuote;
  symbolKind: VenueSymbolKind;
  datedCarry: boolean;
  dcaBoth: boolean;
  tvWebhook: boolean;
  auth: string;
  demoRole: string;
  paperMarket: string;
  liveOrders: string;
  nativeTpsl: string;
  environments: readonly VenueEnvironment[];
  credentialFields: readonly VenueCredentialField[];
};

export const VENUES: readonly VenueDefinition[] = [
  {
    id: "bybit",
    label: "Bybit",
    enabled: true,
    connectionsEnabled: true,
    deskTypes: ["cash_and_carry", "perps", "signal_follower", "dca"],
    positionMode: "hedge",
    quote: "USDT",
    symbolKind: "linear_usdt",
    datedCarry: true,
    dcaBoth: true,
    tvWebhook: true,
    auth: "hmac",
    demoRole: "Bybit Demo API",
    paperMarket: "Bybit public",
    liveOrders: "REST v5",
    nativeTpsl: "trading-stop",
    environments: [
      {
        id: "live",
        label: "Live",
        aliases: ["production", "mainnet"],
        host: "https://api.bybit.com",
      },
      {
        id: "demo",
        label: "Demo",
        host: "https://api-demo.bybit.com",
      },
    ],
    credentialFields: [
      { key: "apiKey", label: "API key", secret: false },
      { key: "apiSecret", label: "API secret", secret: true },
    ],
  },
  {
    id: "hyperliquid",
    label: "Hyperliquid",
    enabled: true,
    connectionsEnabled: true,
    deskTypes: ["perps", "signal_follower", "dca"],
    positionMode: "one_way",
    quote: "USDC",
    symbolKind: "coin",
    datedCarry: false,
    dcaBoth: false,
    tvWebhook: true,
    auth: "agent",
    demoRole: "Hyperliquid Testnet",
    paperMarket: "Hyperliquid public info",
    liveOrders: "signed /exchange",
    nativeTpsl: "trigger orders",
    environments: [
      {
        id: "testnet",
        label: "Demo (Hyperliquid Testnet)",
        aliases: ["demo"],
        host: "https://api.hyperliquid-testnet.xyz",
      },
      {
        id: "live",
        label: "Live",
        aliases: ["mainnet"],
        host: "https://api.hyperliquid.xyz",
      },
    ],
    credentialFields: [
      { key: "accountAddress", label: "Account address", secret: false },
      { key: "agentKey", label: "Agent private key", secret: true },
    ],
  },
];

export function enabledVenues(): VenueDefinition[] {
  return VENUES.filter((venue) => venue.enabled && venue.connectionsEnabled);
}

export function connectionVenuesForDeskType(
  deskType: VenueDeskType,
): VenueDefinition[] {
  return venuesForDeskType(deskType).filter((venue) => venue.connectionsEnabled);
}

export function getVenue(id: string): VenueDefinition | null {
  return VENUES.find((venue) => venue.id === id) ?? null;
}

export function venuesForDeskType(deskType: VenueDeskType): VenueDefinition[] {
  return VENUES.filter(
    (venue) => venue.enabled && venue.deskTypes.includes(deskType),
  );
}

export function venueAllowsDeskType(
  venue: VenueDefinition,
  deskType: string,
): boolean {
  return venue.deskTypes.includes(deskType as VenueDeskType);
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

export function parseConnectionVenueId(
  raw: unknown,
): { ok: true; venue: VenueDefinition } | { ok: false; error: string } {
  const parsed = parseVenueId(raw);
  if (!parsed.ok) {
    return parsed;
  }
  if (!parsed.venue.connectionsEnabled) {
    return { ok: false, error: "That exchange is not available yet." };
  }
  return parsed;
}

export function parseStoredVenueId(raw: unknown): string {
  const id = String(raw ?? "").trim();
  return getVenue(id)?.id ?? "bybit";
}

export function parseVenueEnvironment(
  venue: VenueDefinition,
  raw: unknown,
): { ok: true; environment: VenueEnvironment } | { ok: false; error: string } {
  const id = String(raw ?? "").trim();
  const environment = venue.environments.find(
    (item) => item.id === id || item.aliases?.includes(id),
  );
  if (!environment) {
    return { ok: false, error: "Unknown environment for that exchange." };
  }
  return { ok: true, environment };
}

export function parseStoredVenueEnvironment(
  venueId: string,
  raw: unknown,
): string | null {
  const value = String(raw ?? "").trim();
  if (!value) {
    return null;
  }
  const venue = getVenue(venueId);
  if (!venue) {
    return value;
  }
  const parsed = parseVenueEnvironment(venue, value);
  return parsed.ok ? parsed.environment.id : value;
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

export function connectionFitsDesk(input: {
  deskVenue: string;
  deskEnvironment: string | null;
  connectionVenue: string;
  connectionEnvironment: string;
}): { ok: true } | { ok: false; error: string } {
  const venue = getVenue(input.deskVenue);
  if (!venue || input.connectionVenue !== venue.id) {
    return {
      ok: false,
      error: `This desk is ${venue?.label ?? input.deskVenue}. Pick a matching connection.`,
    };
  }
  if (!input.deskEnvironment) {
    return { ok: true };
  }
  const deskEnv = parseVenueEnvironment(venue, input.deskEnvironment);
  const connEnv = parseVenueEnvironment(venue, input.connectionEnvironment);
  if (
    !deskEnv.ok ||
    !connEnv.ok ||
    deskEnv.environment.id !== connEnv.environment.id
  ) {
    return {
      ok: false,
      error: "That connection is the wrong Demo / Live track for this desk.",
    };
  }
  return { ok: true };
}

export function connectionsForDeskBind<
  T extends {
    id: string;
    venue: string;
    environment: string;
    status: string;
  },
>(
  connections: readonly T[],
  desk: { venue: string; venueEnvironment: string | null },
  selectedId?: string | null,
): T[] {
  return connections.filter((row) => {
    if (row.id === selectedId) {
      return true;
    }
    if (row.status !== "active") {
      return false;
    }
    return connectionFitsDesk({
      deskVenue: desk.venue,
      deskEnvironment: desk.venueEnvironment,
      connectionVenue: row.venue,
      connectionEnvironment: row.environment,
    }).ok;
  });
}
