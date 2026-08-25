export function FuturesFlash({
  opened,
  added,
  closed,
  liveOpened,
  liveAdded,
  liveClosed,
  error,
}: {
  opened: boolean;
  added?: boolean;
  closed?: boolean;
  liveOpened?: boolean;
  liveAdded?: boolean;
  liveClosed?: boolean;
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
        Futures opened on the connected exchange.
      </p>
    );
  }
  if (liveAdded) {
    return (
      <p className="text-sm text-success">
        Size added on the connected exchange.
      </p>
    );
  }
  if (liveClosed) {
    return (
      <p className="text-sm text-success">
        Futures closed on the connected exchange.
      </p>
    );
  }
  if (opened) {
    return <p className="text-sm text-success">Paper futures opened.</p>;
  }
  if (added) {
    return <p className="text-sm text-success">Paper size added.</p>;
  }
  if (closed) {
    return <p className="text-sm text-success">Paper futures closed.</p>;
  }
  return null;
}
