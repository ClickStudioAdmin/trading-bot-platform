export function PaperRulesGuide() {
  return (
    <section className="mt-10 rounded-card border border-line bg-surface px-5 py-5">
      <h2 className="text-lg font-semibold tracking-tight">How rules work</h2>
      <p className="mt-2 text-sm text-ink-muted">
        The paper engine scans the live book, then opens or closes paper
        carries using these layers. No Bybit order is sent. Empty fields mean
        that bound is off.
      </p>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Engine
      </h3>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="Enable paper engine"
          detail="When on, the scheduled tick may open and close paper rows. When off, the tick does nothing. Manual Open and Close on the blotter still work."
        />
        <GuideItem
          term="Add rule"
          detail="Adds another layer. Each layer has its own size, entry filters, caps, and exits. Use this to scale in: a modest size at a lower APR, and a larger (or smaller) size only if APR is higher."
        />
        <GuideItem
          term="Which layer is used"
          detail="A pair must pass every filled entry field on a layer. If several layers match, the engine uses the one with the highest min APR. If min APRs tie, it uses the layer that appears first on this page. Example: Rule 1 min APR 10% and $10,000; Rule 2 min APR 20% and $25,000. A pair at 12% net APR uses Rule 1. A pair at 25% uses Rule 2."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Entry
      </h3>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="Size USDT"
          detail="Paper notional for each open this layer creates. P&L is (entry net − mark net − 2 × fees and slip) × this size. Fees are VIP0 taker on both legs plus 5 bp slip, charged for open and for close."
        />
        <GuideItem
          term="Min APR %"
          detail="The pair’s live net APR must be at least this. Net APR is the scanner’s net basis annualized by DTE, after fees and slip. Same number as the book’s Net APR column."
        />
        <GuideItem
          term="Min DTE / Max DTE"
          detail="Days until the dated future expires must sit in this range. Use max DTE to avoid very long tenors; use min DTE to avoid contracts that are about to expire."
        />
        <GuideItem
          term="Min cap USDT"
          detail="The pair’s book capacity must be at least this. Capacity is 25% of the top 5 book levels that stay inside 5 bp of impact — how much size the books can take, not how much you will trade."
        />
        <GuideItem
          term="Max opens"
          detail="How many open paper carries this layer may have at once. Only rows this layer opened count. Manual opens and other layers do not count toward this cap."
        />
        <GuideItem
          term="Max notional"
          detail="Cap on the sum of open notionals for this layer only. A new open is skipped if this size would push the layer over the cap."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Exit
      </h3>
      <p className="mt-2 text-sm text-ink-muted">
        Exits apply only to paper rows this layer opened. First match wins, in
        this order: DTE, then mark APR, then take profit, then stop loss.
      </p>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="Close DTE ≤"
          detail="Close when days to expiry fall to this number or below. Use this to flatten before delivery."
        />
        <GuideItem
          term="Close APR % below"
          detail="Close when the live mark net APR is below this. That is the book’s current net APR, not your P&L %. Use it when the remaining edge has gone."
        />
        <GuideItem
          term="Take profit %"
          detail="Close when all-in P&L % is at least this. P&L % is unrealized ÷ notional, after open and close fee costs. Enter 1 for +1%."
        />
        <GuideItem
          term="Stop loss %"
          detail="Close when all-in P&L % is at or below this loss. Enter 2 to stop at −2%. You type a positive number; the engine treats it as a loss."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Safety
      </h3>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="One open per pair"
          detail="The engine will not open a pair you already hold, even if another layer would match. Manual Open can still stack the same pair."
        />
        <GuideItem
          term="No live mark"
          detail="If the pair is missing from the current scan, the engine will not auto-close it. There is no honest exit price."
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
