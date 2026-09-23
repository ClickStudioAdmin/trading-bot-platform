export function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  const points = value * 100;
  if (!Number.isFinite(points)) {
    return "—";
  }
  return `${points.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return Math.round(value).toLocaleString("en-US");
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

function withSignedUsd(absText: string, value: number): string {
  if (value > 0) {
    return `+$${absText}`;
  }
  if (value < 0) {
    return `−$${absText}`;
  }
  return `$${absText}`;
}

export function formatSignedUsd(value: number): string {
  return withSignedUsd(Math.abs(Math.round(value)).toLocaleString("en-US"), value);
}

/** Row P&L. Amounts under $1 keep up to two decimal places. A non-zero amount that rounds to $0.00 shows <$0.00. Larger amounts stay whole dollars. */
export function formatPnlUsd(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (Math.abs(value) >= 1) {
    return formatSignedUsd(value);
  }
  const cents = Math.round(Math.abs(value) * 100) / 100;
  if (cents === 0) {
    return value === 0 ? "$0" : "<$0.00";
  }
  return withSignedUsd(
    cents.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }),
    value,
  );
}

/** Unrounded P&L for the hover title, up to 8 decimal places. */
export function formatPnlUsdFull(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return withSignedUsd(
    Math.abs(value).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    }),
    value,
  );
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
