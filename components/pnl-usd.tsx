import { formatPnlUsd, formatPnlUsdFull } from "@/lib/opportunities/format";

export function PnlUsd({ value }: { value: number | null | undefined }) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return <span title={formatPnlUsdFull(value)}>{formatPnlUsd(value)}</span>;
}
