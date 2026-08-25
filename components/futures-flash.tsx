export function FuturesFlash({
  opened,
  added,
  closed,
  working,
  cancelled,
  liveOpened,
  liveAdded,
  liveClosed,
  liveWorking,
  tpsl,
  liveTpsl,
  error,
}: {
  opened: boolean;
  added?: boolean;
  closed?: boolean;
  working?: boolean;
  cancelled?: boolean;
  liveOpened?: boolean;
  liveAdded?: boolean;
  liveClosed?: boolean;
  liveWorking?: boolean;
  tpsl?: boolean;
  liveTpsl?: boolean;
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
  if (liveWorking) {
    return (
      <p className="text-sm text-success">
        Limit working on the connected exchange.
      </p>
    );
  }
  if (liveTpsl) {
    return (
      <p className="text-sm text-success">
        TP/SL updated on the connected exchange.
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
  if (working) {
    return <p className="text-sm text-success">Paper limit is working.</p>;
  }
  if (cancelled) {
    return <p className="text-sm text-success">Order cancelled.</p>;
  }
  if (tpsl) {
    return <p className="text-sm text-success">TP/SL updated.</p>;
  }
  return null;
}
