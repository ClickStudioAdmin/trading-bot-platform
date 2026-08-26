import type { SharedKeyWarningKind } from "@/lib/exchanges/connections";

const COPY: Record<SharedKeyWarningKind, string> = {
  pending:
    "Another desk already uses this connection. Both desks will share venue margin. Isolation needs a separate trade-only key.",
  shared:
    "This exchange connection is shared with other desks. They share venue margin. Isolation needs a separate trade-only key.",
};

export function SharedKeyWarning({
  kind,
  className = "",
}: {
  kind: SharedKeyWarningKind;
  className?: string;
}) {
  return (
    <p
      role="note"
      className={`rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning ${className}`}
    >
      {COPY[kind]}
    </p>
  );
}
