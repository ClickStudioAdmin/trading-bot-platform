export function PaperRulesGuide() {
  return (
    <section className="mt-10 rounded-card border border-line bg-surface px-5 py-5">
      <h2 className="text-lg font-semibold tracking-tight">How automations work</h2>
      <p className="mt-2 text-sm text-ink-muted">
        A set is a saved rule card. About every few minutes the paper engine
        scans the live book and may open, add to, or close your paper rows.
        Nothing is sent to Bybit. Leave a field empty to turn that rule off.
      </p>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        The loop
      </h3>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="When it runs"
          detail="Each tick: scan the book, then for each of your sets decide whether to open, add size, or start an exit. Rows already marked Closing keep clipping until they are flat."
        />
        <GuideItem
          term="When it is on"
          detail="The engine is on if you have at least one saved set. With no sets it will not open anything and will not fire DTE, APR, take profit, or stop loss. It still finishes Closing rows."
        />
        <GuideItem
          term="What it can hold"
          detail="Each set may hold one pair unless you raise Max pairs. Extra clips on that same pair still count as one pair. Manual opens and other sets do not count toward this set’s limit."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Sets
      </h3>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="Name"
          detail="Shown as a purple badge next to Auto on Positions. Click that badge on an open row to see the rules copied onto that trade, and to edit that trade’s exits."
        />
        <GuideItem
          term="Add Rule Set"
          detail="Adds another rule card. Each set has its own name, entry filters, size caps, order types, and exits. Save to apply. A green pulse means a live row is using this set — you cannot remove it until that row is flat."
        />
        <GuideItem
          term="Two sets, one pair"
          detail="If more than one set matches the same pair, the engine uses the one with the higher Min APR. If those tie, it uses the set listed first on this page."
        />
        <GuideItem
          term="Saving later"
          detail="A new save applies to new opens. An open row keeps the exits copied when it opened. Change that trade from the set badge on Positions, not by hoping a later save will rewrite it."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Entry · Conditions (all must be true)
      </h3>
      <p className="mt-2 text-sm text-ink-muted">
        A pair must pass every filled entry condition before this set will
        open it. Empty conditions are ignored.
      </p>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="Min APR %"
          detail="Live net APR on the book must be at least this. Same number as the Opportunities Net APR column — basis after fees and slip, annualized by DTE."
        />
        <GuideItem
          term="Min DTE / Max DTE"
          detail="Days until the dated future expires must sit in this range. Use Max DTE to skip very long tenors. Use Min DTE to skip contracts that are about to expire."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Entry · Position and Orders
      </h3>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="Max Position Size"
          detail="Cap on how much notional this set may hold in total. Dynamic fills toward the cap over time. Each clip is the smaller of usable book and leftover room. Fixed skips the open if Order size would go over the cap."
        />
        <GuideItem
          term="Max pairs"
          detail="Ceiling on how many different pairs this set may hold at once. Empty or 1 means one pair. Dynamic still opens only the best pair first and adds to it. Adding size on the same pair is not a new pair."
        />
        <GuideItem
          term="Order Type · Fixed"
          detail="Opens Order size once, on a pair this set does not already hold. It will not add later clips on that pair."
        />
        <GuideItem
          term="Order Type · Dynamic (scale in)"
          detail="Each tick may add one clip. If this set holds a pair, the clip goes on the held pair with the highest net APR that still clears Min Order Size. If it holds none, it opens one row on the best matching pair. It will not open a second pair on the same tick, even if Max pairs is higher. Clip size is usable book, or leftover room under Max Position Size — whichever is smaller."
        />
        <GuideItem
          term="Order size (USDT)"
          detail="Fixed only. The paper size of that single open."
        />
        <GuideItem
          term="Min usable book"
          detail="Fixed only. The pair’s usable book must be at least this before Order size is used."
        />
        <GuideItem
          term="Min Order Size"
          detail="Dynamic only. Skip a clip if it would be smaller than this. The last leftover on an exit still flattens so the row can finish. The last entry clip is skipped if leftover room is below this, so the cap may sit a little under Max Position Size."
        />
        <GuideItem
          term="Usable book"
          detail="Your Settings share of the top 5 book levels inside 5 bp of impact. Default is 25%. Manual Size, Dynamic clips, and Dynamic exits all use this."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Exit · When the engine closes
      </h3>
      <p className="mt-2 text-sm text-ink-muted">
        These conditions apply only to rows this set opened, and only on a
        tick — not when you click Close. First match wins: DTE, then mark APR,
        then take profit, then stop loss.
      </p>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="DTE ≤"
          detail="Start exiting when days to expiry fall to this number or below."
        />
        <GuideItem
          term="APR % below"
          detail="Start exiting when the live mark net APR is below this. That is the book’s current net APR, not your P&L %."
        />
        <GuideItem
          term="Take profit %"
          detail="Exit when all-in P&L reaches this percent of the size at entry. Enter 10 for +10% ($1,000 on a $10,000 entry). Fees to open and close are already in that P&L."
        />
        <GuideItem
          term="Stop loss %"
          detail="Exit when all-in P&L is at or below this loss. Enter 10 to stop at −10% (−$1,000 on a $10,000 entry). Type a positive number; the engine treats it as a loss."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Exit · How much closes
      </h3>
      <p className="mt-2 text-sm text-ink-muted">
        Once an exit has started — from a rule or from you clicking Close —
        only the exit order type decides how much comes off.
      </p>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="Order Type · Fixed"
          detail="Closes the whole remaining row in one go."
        />
        <GuideItem
          term="Order Type · Dynamic (scale out)"
          detail="Each tick closes up to the current usable book. The row shows Closing until it is flat. A leftover smaller than Min Order Size still finishes so the row can close."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Close and Unwind on Positions
      </h3>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="Auto Close"
          detail="You already chose to exit. DTE, APR, take profit, and stop loss are ignored. Only this set’s exit order type is used: Fixed flattens now, Dynamic clips once and marks Closing."
        />
        <GuideItem
          term="Manual Close"
          detail="Always flattens the remaining size at the live scan."
        />
        <GuideItem
          term="Unwind"
          detail="Manual rows only. Clips to usable book and marks Closing. Later ticks finish the rest."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Safety
      </h3>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="No live mark"
          detail="If the pair is missing from the current scan, the engine will not auto-close it. There is no honest exit price or usable book."
        />
        <GuideItem
          term="Manual trades"
          detail="Rows you opened by hand are not closed by these rules. Use Close or Unwind yourself."
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
