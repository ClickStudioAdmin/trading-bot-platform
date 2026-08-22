export function PaperRulesGuide() {
  return (
    <section className="mt-10 rounded-card border border-line bg-surface px-5 py-5">
      <h2 className="text-lg font-semibold tracking-tight">How automations work</h2>
      <p className="mt-2 text-sm text-ink-muted">
        The paper engine scans the live book, then opens or closes paper
        carries using these layers. No Bybit order is sent. Empty fields mean
        that bound is off.
      </p>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Automations
      </h3>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="Enable automations"
          detail="When on, the scheduled tick may open and close paper rows. When off, the tick does nothing. Manual Open and Close on the blotter still work."
        />
        <GuideItem
          term="Add rule"
          detail="Adds another layer. Each layer has its own entry conditions, position caps, order types, and exits. If several layers match a pair, the engine uses the one with the highest min APR. If min APRs tie, it uses the layer that appears first on this page."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Entry · Conditions
      </h3>
      <p className="mt-2 text-sm text-ink-muted">
        All filled entry conditions must be true before this layer looks to
        open. Empty conditions are ignored.
      </p>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="Min APR %"
          detail="The pair’s live net APR must be at least this. Net APR is the scanner’s net basis annualized by DTE, after fees and slip. Same number as the book’s Net APR column."
        />
        <GuideItem
          term="Min DTE / Max DTE"
          detail="Days until the dated future expires must sit in this range. Use max DTE to avoid very long tenors; use min DTE to avoid contracts that are about to expire."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Entry · Position and Orders
      </h3>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="Max Position Size"
          detail="Cap on the sum of open sizes this layer created. Dynamic fills up to this cap over time. A new clip is sized to the leftover room when the next book-sized clip would overshoot. Fixed skips if Order size would push the sum over the cap."
        />
        <GuideItem
          term="Max opens"
          detail="Maximum number of open paper rows this layer may have. Each Dynamic clip counts as one open. Manual opens and other layers do not count."
        />
        <GuideItem
          term="Order Type"
          detail="Fixed opens one Order size on a pair you do not already hold. Dynamic scales in: each tick may add one clip on a matching pair, sized to current book value (or leftover room under Max Position Size), until the cap is met. Book value is 25% of the top 5 book levels inside 5 bp of impact."
        />
        <GuideItem
          term="Order size (USDT)"
          detail="Fixed only. Paper size of the single open this layer creates on a pair."
        />
        <GuideItem
          term="Min book value"
          detail="Fixed only. The pair’s book value must be at least this before that Order size is used."
        />
        <GuideItem
          term="Min Order Size"
          detail="Dynamic entry and exit. Skip a clip if it would be below this, except the last leftover exit which always flattens so the position can finish. The last entry clip is also skipped if leftover room under Max Position Size is below this, so the cap may sit slightly under."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Exit · Conditions
      </h3>
      <p className="mt-2 text-sm text-ink-muted">
        Exits apply only to paper rows this layer opened. If either filled
        condition is true, the layer starts exiting. First match wins: DTE,
        then mark APR, then take profit, then stop loss.
      </p>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="DTE ≤"
          detail="Start exiting when days to expiry fall to this number or below. Use this to flatten before delivery."
        />
        <GuideItem
          term="APR % below"
          detail="Start exiting when the live mark net APR is below this. That is the book’s current net APR, not your P&L %. Use it when the remaining edge has gone."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Exit · Position and Orders
      </h3>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="Order Type"
          detail="Fixed closes the whole paper row when an exit fires. Dynamic scales out: each tick closes up to the current book value (and not below Min Order Size, unless this is the last leftover). Oldest rows on a pair go first. It keeps clipping until the position is flat."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Exit · Stops
      </h3>
      <p className="mt-2 text-sm text-ink-muted">
        Percents are of the paper size at entry, not of mark APR. A $10,000
        entry with a 10% take profit exits when all-in P&L is at least $1,000.
        A 10% stop exits when all-in P&L is at or below −$1,000.
      </p>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="Take profit %"
          detail="Exit when all-in P&L reaches this percent of entry notional, after open and close fee costs. Enter 10 for +10% ($1,000 on a $10,000 entry)."
        />
        <GuideItem
          term="Stop loss %"
          detail="Exit when all-in P&L is at or below this loss, as a percent of entry notional. Enter 10 to stop at −10% (−$1,000 on a $10,000 entry). You type a positive number; the engine treats it as a loss."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Safety
      </h3>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="Fixed: one open per pair"
          detail="A Fixed layer will not open a pair you already hold. Dynamic may add clips on a pair you already hold until Max Position Size or Max opens is reached. Manual Open can still stack the same pair."
        />
        <GuideItem
          term="No live mark"
          detail="If the pair is missing from the current scan, the engine will not auto-close it. There is no honest exit price or book value."
        />
        <GuideItem
          term="Manual trades"
          detail="Rows you opened by hand are not auto-closed. Close those from Current trades."
        />
      </dl>
    </section>
  );
}

function GuideItem({
  term,
  detail,
}: {
  term: string;
  detail: string;
}) {
  return (
    <div>
      <dt className="font-medium text-ink">{term}</dt>
      <dd className="mt-0.5 text-ink-muted">{detail}</dd>
    </div>
  );
}
