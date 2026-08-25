import { LocalTime } from "@/components/local-time";

export function LastScan({ atMs }: { atMs: number | null }) {
  return (
    <p className="text-xs tabular-nums text-ink-muted">
      Last scan <LocalTime at={atMs} mode="datetime-short" />
    </p>
  );
}
