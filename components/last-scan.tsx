import { formatScanAt } from "@/lib/opportunities/format";

export function LastScan({ atMs }: { atMs: number | null }) {
  return (
    <p className="text-xs tabular-nums text-ink-muted">
      Last scan {formatScanAt(atMs)}
    </p>
  );
}
