import { getVenue } from "@/lib/exchanges/venues";

export function hyperliquidHost(environmentId: string): string | null {
  const venue = getVenue("hyperliquid");
  const environment = venue?.environments.find(
    (item) => item.id === environmentId || item.aliases?.includes(environmentId),
  );
  return environment?.host ?? null;
}

export function hyperliquidInfoUrl(environmentId: string): string | null {
  const host = hyperliquidHost(environmentId);
  return host ? `${host}/info` : null;
}

export function hyperliquidExchangeUrl(environmentId: string): string | null {
  const host = hyperliquidHost(environmentId);
  return host ? `${host}/exchange` : null;
}

export function hyperliquidIsMainnet(environmentId: string): boolean {
  const venue = getVenue("hyperliquid");
  const environment = venue?.environments.find(
    (item) => item.id === environmentId || item.aliases?.includes(environmentId),
  );
  return environment?.id === "live";
}
