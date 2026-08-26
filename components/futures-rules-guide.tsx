export function FuturesRulesGuide({
  exchangeBook = false,
}: {
  exchangeBook?: boolean;
}) {
  return (
    <section className="mt-10 rounded-card border border-line bg-surface px-5 py-5">
      <h2 className="text-lg font-semibold tracking-tight">
        How automations work
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        {exchangeBook
          ? "Each rule watches one USDT linear perpetual. About every few minutes the tick reads last, mark, and index, then may Buy, Sell, or Close on the bound book. Those are the same commands as a click on Positions. TradingView webhooks are next."
          : "Each rule watches one USDT linear perpetual. About every few minutes the tick reads last, mark, and index, then may Buy, Sell, or Close on this paper book. Nothing is sent to Bybit. TradingView webhooks are next."}
      </p>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        The loop
      </h3>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="When it fires"
          detail="A rule fires on the first tick the condition is true, then waits until it is false again. It does not repeat every tick while price stays through the level."
        />
        <GuideItem
          term="When it is on"
          detail="Active may Buy, Sell, and Close. Reduce only will not Buy or Sell, but still Closes. Disabled does neither. Book Reduce only (Strategy Settings, or the Close All checkbox) makes every Active rule behave as Reduce only. Manual Buy, Sell, and Close always work."
        />
        <GuideItem
          term="Same desk path"
          detail="Fires call runFuturesCommand with an idempotency key. Live uses the Futures bind. Paper writes the ledger only. Risk caps, hedge long+short, and Market or Limit are the same as the ticket."
        />
      </dl>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        Fields
      </h3>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="Skip if this side is already open"
          detail="On by default for Buy and Sell so a cross does not add size. Turn it off if you want each new cross to add to the same long or short."
        />
        <GuideItem
          term="Close long / Close short"
          detail="Closes that side on this contract. Empty qty closes the whole row. If nothing is open, the rule waits until there is a row, then closes it while the condition is still true."
        />
        <GuideItem
          term="Auto badge"
          detail="Positions opened by a rule show Auto. Manual clicks stay Manual. Take profit, stop loss, and trailing stay on the row, the same as a desk order."
        />
      </dl>
    </section>
  );
}

function GuideItem({ term, detail }: { term: string; detail: string }) {
  return (
    <div>
      <dt className="font-medium text-ink">{term}</dt>
      <dd className="mt-0.5 text-ink-muted">{detail}</dd>
    </div>
  );
}
