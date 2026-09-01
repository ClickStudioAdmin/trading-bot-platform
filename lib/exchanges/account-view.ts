export type VenueMarginMode = "cross" | "isolated" | "portfolio";

export type VenueAccountSnapshot = {
  marginMode: VenueMarginMode | null;
  leverage: number | null;
  initialMarginRate: number | null;
  maintenanceMarginRate: number | null;
  marginBalance: number | null;
  availableBalance: number | null;
};

export type AccountSnapshotView =
  | { ok: true; snapshot: VenueAccountSnapshot }
  | { ok: false; error: string };

export function formatMarginModeLabel(mode: VenueMarginMode | null): string {
  if (mode === "cross") {
    return "Cross";
  }
  if (mode === "isolated") {
    return "Isolated";
  }
  if (mode === "portfolio") {
    return "Portfolio";
  }
  return "Unified";
}

export function pickDisplayLeverage(
  values: readonly (number | null | undefined)[],
): number | null {
  const nums = values.filter(
    (value): value is number =>
      value != null && value > 0 && Number.isFinite(value),
  );
  if (nums.length === 0) {
    return null;
  }
  const first = nums[0];
  if (nums.every((value) => value === first)) {
    return first;
  }
  return null;
}

export function formatMarginModeWithLeverage(
  mode: VenueMarginMode | null,
  leverage: number | null | undefined,
): string {
  const label = formatMarginModeLabel(mode);
  if (leverage == null || !(leverage > 0) || !Number.isFinite(leverage)) {
    return label;
  }
  return `${label} ${leverage}×`;
}

export function marginRateTone(rate: number | null): string {
  if (rate === null) {
    return "text-ink";
  }
  if (rate >= 0.8) {
    return "text-danger";
  }
  if (rate >= 0.5) {
    return "text-warning";
  }
  return "text-success";
}

export function formatSnapshotMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
