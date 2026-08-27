export function FuturesFlash({
  opened,
  added,
  closed,
  working,
  cancelled,
  amended,
  liveOpened,
  liveAdded,
  liveClosed,
  liveWorking,
  liveAmended,
  tpsl,
  liveTpsl,
  trailing,
  liveTrailing,
  closedAll,
  liveClosedAll,
  cancelledAll,
  closedAndCancelled,
  liveClosedAndCancelled,
  webhookArm,
  playbookClosed,
  livePlaybookClosed,
  error,
}: {
  opened: boolean;
  added?: boolean;
  closed?: boolean;
  working?: boolean;
  cancelled?: boolean;
  amended?: boolean;
  liveOpened?: boolean;
  liveAdded?: boolean;
  liveClosed?: boolean;
  liveWorking?: boolean;
  liveAmended?: boolean;
  tpsl?: boolean;
  liveTpsl?: boolean;
  trailing?: boolean;
  liveTrailing?: boolean;
  closedAll?: boolean;
  liveClosedAll?: boolean;
  cancelledAll?: boolean;
  closedAndCancelled?: boolean;
  liveClosedAndCancelled?: boolean;
  webhookArm?: boolean;
  playbookClosed?: boolean;
  livePlaybookClosed?: boolean;
  error?: string;
}) {
  if (error) {
    return (
      <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        {error}
      </p>
    );
  }
  if (webhookArm) {
    return (
      <p className="text-sm text-success">
        Signal accepted. If an automation uses that webhook, it just fired.
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
  if (livePlaybookClosed) {
    return (
      <p className="text-sm text-success">
        Playbook closed on the connected exchange. Positions flattened and the
        playbook is idle.
      </p>
    );
  }
  if (liveClosedAndCancelled) {
    return (
      <p className="text-sm text-success">
        Working orders cancelled and open positions closed on the connected
        exchange.
      </p>
    );
  }
  if (liveClosedAll) {
    return (
      <p className="text-sm text-success">
        Open positions closed on the connected exchange.
      </p>
    );
  }
  if (liveClosed) {
    return (
      <p className="text-sm text-success">
        Close filled on the connected exchange.
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
  if (liveAmended) {
    return (
      <p className="text-sm text-success">
        Limit updated on the connected exchange.
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
  if (liveTrailing) {
    return (
      <p className="text-sm text-success">
        Trailing stop updated on the connected exchange.
      </p>
    );
  }
  if (opened) {
    return <p className="text-sm text-success">Paper futures opened.</p>;
  }
  if (added) {
    return <p className="text-sm text-success">Paper size added.</p>;
  }
  if (playbookClosed) {
    return (
      <p className="text-sm text-success">
        Playbook closed. Positions flattened and the playbook is idle.
      </p>
    );
  }
  if (closedAndCancelled) {
    return (
      <p className="text-sm text-success">
        Working orders cancelled and paper positions closed.
      </p>
    );
  }
  if (closedAll) {
    return <p className="text-sm text-success">Open positions closed.</p>;
  }
  if (cancelledAll) {
    return <p className="text-sm text-success">Working orders cancelled.</p>;
  }
  if (closed) {
    return <p className="text-sm text-success">Paper close filled.</p>;
  }
  if (working) {
    return <p className="text-sm text-success">Paper limit is working.</p>;
  }
  if (cancelled) {
    return <p className="text-sm text-success">Order cancelled.</p>;
  }
  if (amended) {
    return <p className="text-sm text-success">Paper limit updated.</p>;
  }
  if (tpsl) {
    return <p className="text-sm text-success">TP/SL updated.</p>;
  }
  if (trailing) {
    return <p className="text-sm text-success">Trailing stop updated.</p>;
  }
  return null;
}
