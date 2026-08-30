export type VenueMarginMode = "cross" | "isolated" | "portfolio";

export type VenueAccountSnapshot = {
  marginMode: VenueMarginMode | null;
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
