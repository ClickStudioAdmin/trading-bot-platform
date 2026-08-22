export function PaperFlash({
  opened,
  closed,
  exits,
  unwinding,
  error,
}: {
  opened: boolean;
  closed?: boolean;
  exits?: boolean;
  unwinding?: boolean;
  error?: string;
}) {
  if (error) {
    return (
      <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        {error}
      </p>
    );
  }
  if (opened) {
    return (
      <p className="text-sm text-success">
        Paper carry opened. No exchange order was sent.
      </p>
    );
  }
  if (closed) {
    return (
      <p className="text-sm text-success">
        Paper carry closed. No exchange order was sent.
      </p>
    );
  }
  if (unwinding) {
    return (
      <p className="text-sm text-success">
        Paper carry is closing. Further clips use usable book. No exchange
        order was sent.
      </p>
    );
  }
  if (exits) {
    return (
      <p className="text-sm text-success">
        Paper carry exits updated. That trade only — the automation rule is unchanged.
      </p>
    );
  }
  return null;
}
