export function PaperFlash({
  opened,
  closed,
  exits,
  error,
}: {
  opened: boolean;
  closed?: boolean;
  exits?: boolean;
  error?: string;
}) {
  if (error) {
    return (
      <p className="mt-3 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        {error}
      </p>
    );
  }
  if (opened) {
    return (
      <p className="mt-3 text-sm text-success">
        Paper carry opened. No exchange order was sent.
      </p>
    );
  }
  if (closed) {
    return (
      <p className="mt-3 text-sm text-success">
        Paper carry closed. No exchange order was sent.
      </p>
    );
  }
  if (exits) {
    return (
      <p className="mt-3 text-sm text-success">
        Paper carry exits updated. That trade only — the automation rule is unchanged.
      </p>
    );
  }
  return null;
}
