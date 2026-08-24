export function formatPct(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${(value * 100).toFixed(2)}%`;
}

export function formatScanAt(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) {
    return "—";
  }
  return `${new Date(ms).toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

export function formatUsd(value: number): string {
  if (value <= 0) {
    return "—";
  }
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function formatUsdCapacity(value: number): string {
  const whole = Math.floor(value);
  if (!(whole > 0)) {
    return "—";
  }
  return `$${whole.toLocaleString("en-US")}`;
}

export function formatPrice(value: number | null): string {
  if (value === null || !(value > 0)) {
    return "—";
  }
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : 8;
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function formatSignedUsd(value: number): string {
  const formatted = `$${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
  if (value > 0) {
    return `+${formatted}`;
  }
  if (value < 0) {
    return `−${formatted}`;
  }
  return formatted;
}

export function signedTone(value: number | null): string {
  if (value === null) {
    return "text-ink-faint";
  }
  if (value > 0) {
    return "text-success";
  }
  if (value < 0) {
    return "text-danger";
  }
  return "text-ink-faint";
}
