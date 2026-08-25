import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { getSessionContext } from "@/lib/auth/session";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { FUTURES_PATHS } from "@/lib/strategies/registry";

export const metadata: Metadata = {
  title: "Futures automations",
  description: "Automation rules for USDT linear perpetuals.",
};

export default async function FuturesAutomationsPage() {
  const session = await getSessionContext();
  const settings = session ? await loadFuturesSettings(session.account.id) : null;

  return (
    <main className="mx-auto max-w-6xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Automations" />
      {settings?.reduceOnly ? (
        <p className="mb-4 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Reduce only is on. Buy and Sell stay blocked until you turn it off in{" "}
          <Link href={FUTURES_PATHS.settings} className="underline">
            Strategy Settings
          </Link>
          .
        </p>
      ) : null}
      <section className="rounded-card border border-line bg-surface p-5">
        <h3 className="text-sm font-medium text-ink">Nothing automated yet</h3>
        <p className="mt-2 text-sm text-ink-muted">
          This tab will hold alert automations for Buy, Sell, and Close on the
          bound book. TradingView webhooks are next. Until then, orders are
          manual.
        </p>
        <p className="mt-4">
          <Link
            href={FUTURES_PATHS.positions}
            className="text-sm text-accent hover:text-accent-strong"
          >
            Place an order on Positions
          </Link>
        </p>
      </section>
      <section className="mt-8 rounded-card border border-line bg-surface px-5 py-5">
        <h2 className="text-lg font-semibold tracking-tight">
          How automations will work
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Same desk rules as a manual click: one USDT linear perpetual, long and
          short can both be open. Close a side from the open row. Paper writes the
          ledger only. Live places one Bybit market order from the Futures bind.
        </p>
      </section>
    </main>
  );
}
