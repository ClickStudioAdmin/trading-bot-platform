export function formatPct(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${(value * 100).toFixed(2)}%`;
}

export function formatUsd(value: number): string {
  if (value <= 0) {
    return "—";
  }
  return `$${Math.round(value).toLocaleString("en-US")}`;
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
