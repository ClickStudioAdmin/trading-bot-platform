const LEVERAGE_PREFIX = /^(10000000|1000000|10000|1000)/;

export function iconLookupKeys(symbol: string): string[] {
  const raw = symbol.trim().toUpperCase();
  if (!raw) {
    return [];
  }
  const stripped = raw.replace(LEVERAGE_PREFIX, "") || raw;
  if (stripped === raw) {
    return [raw];
  }
  return [raw, stripped];
}

export function marketIconsByBase(
  rows: readonly { symbol: string; image: string }[],
): Map<string, string> {
  const icons = new Map<string, string>();
  for (const row of rows) {
    const key = row.symbol.trim().toUpperCase();
    const image = row.image.trim();
    if (!key || icons.has(key) || !isHttpsIconUrl(image)) {
      continue;
    }
    icons.set(key, image);
  }
  return icons;
}

export function iconUrlForSymbol(
  icons: ReadonlyMap<string, string> | Record<string, string>,
  symbol: string,
): string | null {
  const lookup =
    icons instanceof Map
      ? (key: string) => icons.get(key)
      : (key: string) => (icons as Record<string, string>)[key];
  for (const key of iconLookupKeys(symbol)) {
    const url = lookup(key);
    if (url) {
      return url;
    }
  }
  return null;
}

function isHttpsIconUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
