import { formatNavBadgeCount } from "@/lib/notifications/badge-model";

export function NavBadge({ count }: { count: number }) {
  const label = formatNavBadgeCount(count);
  if (!label) {
    return null;
  }
  return (
    <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-warning/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-warning">
      {label}
    </span>
  );
}
