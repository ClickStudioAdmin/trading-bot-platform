export function SharedKeyWarning({ className = "" }: { className?: string }) {
  return (
    <p
      role="note"
      className={`rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning ${className}`}
    >
      Two desks on the same exchange key still share venue margin. Isolation
      needs another trade-only key.
    </p>
  );
}
