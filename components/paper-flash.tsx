export function PaperFlash({
  opened,
  closed,
  exits,
  unwinding,
  liveOpened,
  liveAdded,
  liveClosed,
  liveUnwinding,
  error,
}: {
  opened: boolean;
  closed?: boolean;
  exits?: boolean;
  unwinding?: boolean;
  liveOpened?: boolean;
  liveAdded?: boolean;
  liveClosed?: boolean;
  liveUnwinding?: boolean;
  error?: string;
}) {
  if (error) {
    return (
      <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        {error}
      </p>
    );
  }
  if (liveOpened) {
    return (
      <p className="text-sm text-success">
        Cash-and-carry opened on the connected exchange.
      </p>
    );
  }
  if (liveAdded) {
    return (
      <p className="text-sm text-success">
        Size added to the existing cash-and-carry on the connected exchange.
      </p>
    );
  }
  if (liveClosed) {
    return (
      <p className="text-sm text-success">
        Cash-and-carry closed on the connected exchange.
      </p>
    );
  }
  if (liveUnwinding) {
    return (
      <p className="text-sm text-success">
        Cash-and-carry is closing on the connected exchange. Later ticks clip
        to usable book.
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
