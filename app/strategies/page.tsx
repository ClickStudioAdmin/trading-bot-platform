import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = {
  title: "Strategies",
  description: "Trading strategies on the desk.",
};

export default function StrategiesPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeading overline="Desk" title="Strategies" />
      <p className="-mt-2 text-sm text-ink-muted">
        Each strategy has its own landing page. Related screens live under
        that path.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link
          href="/strategies/cash-and-carry"
          className="rounded-card border border-line bg-surface p-6 hover:border-line-strong hover:bg-surface-raised"
        >
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            Strategy
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            Cash and Carry
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Buy USDT spot, sell the dated future. Live book, paper carries,
            and the pair list.
          </p>
        </Link>
        <Link
          href="/strategies/futures"
          className="rounded-card border border-line bg-surface p-6 hover:border-line-strong hover:bg-surface-raised"
        >
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            Strategy
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            Futures
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Buy or sell one USDT linear perpetual on Bybit. Close from the open
            row.
          </p>
        </Link>
      </div>
    </main>
  );
}
