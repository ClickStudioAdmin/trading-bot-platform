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

const QTY_DISPLAY_DECIMALS = 3;
const QTY_FLOOR_EPS = 1e-8;

export function formatQty(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (value === 0) {
    return (0).toFixed(QTY_DISPLAY_DECIMALS);
  }
  const factor = 10 ** QTY_DISPLAY_DECIMALS;
  const floored = Math.floor(value * factor + QTY_FLOOR_EPS) / factor;
  if (!(floored > 0) && value > 0) {
    return formatQtyFull(value);
  }
  return floored.toFixed(QTY_DISPLAY_DECIMALS);
}

export function formatQtyFull(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return String(value);
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
