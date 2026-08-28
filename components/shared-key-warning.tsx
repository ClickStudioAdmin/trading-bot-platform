import type { SharedKeyWarningKind } from "@/lib/exchanges/connections";

const SHARED_CONNECTION_WARNING =
  "Another desk uses this exchange connection. This is allowed but understand that it adds risk due to shared exchange balances and margin requirements.";

const COPY: Record<SharedKeyWarningKind, string> = {
  pending: SHARED_CONNECTION_WARNING,
  shared: SHARED_CONNECTION_WARNING,
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
