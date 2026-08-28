export function FuturesRulesGuide({
  exchangeBook = false,
}: {
  exchangeBook?: boolean;
}) {
  return (
    <section className="mt-10 rounded-card border border-line bg-surface px-5 py-5">
      <h2 className="text-lg font-semibold tracking-tight">
        How bots work
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        {exchangeBook
          ? "Each bot watches one USDT linear perpetual. About every few minutes the tick reads last, mark, and index, then may Buy, Sell, or Close on the bound book. Those are the same commands as a click on Positions. TradingView URLs live on Webhooks."
          : "Each bot watches one USDT linear perpetual. About every few minutes the tick reads last, mark, and index, then may Buy, Sell, or Close on this paper book. Nothing is sent to Bybit. TradingView URLs live on Webhooks."}
      </p>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
        The loop
      </h3>
      <dl className="mt-3 space-y-3 text-sm">
        <GuideItem
          term="When it fires"
          detail="When can be a price cross or a named Signal webhook. A price bot fires on the first tick the condition is true, then waits until it is false again. A Signal bot fires when that webhook arms."
        />
        <GuideItem
          term="When it is on"
          detail="Active may Buy, Sell, and Close. Reduce only will not Buy or Sell, but still Closes. Disabled does neither. Book Reduce only (Desk Settings, or the Close All checkbox) makes every Active bot behave as Reduce only. Manual Buy, Sell, and Close always work."
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
          term="Add bot"
          detail="Adds a blank bot card. Clone existing bot copies a saved bot, names it with (copy), and leaves it unsaved until you Save Bots. A new clone can fire on the next cross — change the contract or disable it first if you do not want two of the same bot."
        />
        <GuideItem
          term="Skip if this side is already open"
          detail="On by default for Buy and Sell so a cross does not add size. Turn it off if you want each new cross to add to the same long or short."
        />
        <GuideItem
          term="Close long / Close short"
          detail="Closes that side on this contract. Empty qty closes the whole row. If nothing is open, the bot waits until there is a row, then closes it while the condition is still true."
        />
        <GuideItem
          term="Source"
          detail="Positions, open orders, order details, and Activity logs show Manual, Auto, or Webhook. Auto is a bot (price cross or a Signal that fired a bot). Webhook is a TradingView strategy that placed Buy, Sell, or Close itself. The name is that bot or webhook."
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
