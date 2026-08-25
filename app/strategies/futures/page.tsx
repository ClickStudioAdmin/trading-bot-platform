import type { Metadata } from "next";
import Link from "next/link";
import { FuturesFlash } from "@/components/futures-flash";
import { fetchBybitTickers } from "@/lib/exchanges/bybit/client";
import { loadFuturesPositions } from "@/lib/futures/list";
import { futuresPnlUsdt, markFromTicker } from "@/lib/futures/math";
import { firstSearchValue } from "@/lib/paper/open";
import {
  formatPrice,
  formatSignedUsd,
  signedTone,
} from "@/lib/opportunities/format";
import { FUTURES_PATHS } from "@/lib/strategies/registry";

export const metadata: Metadata = {
  title: "Futures",
  description: "USDT linear perpetual buy, sell, and flatten.",
};

export default async function FuturesOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const open = await loadFuturesPositions({ status: "open" });
  let tickers = new Map<string, { lastPrice?: string; bid1Price?: string; ask1Price?: string }>();
  try {
    if (open.length > 0) {
      tickers = await fetchBybitTickers("linear");
    }
  } catch {
    tickers = new Map();
  }
  const unrealized = open.reduce((sum, row) => {
    const mark = markFromTicker(tickers.get(row.symbol) ?? {});
    if (mark === null) {
      return sum;
    }
    return (
      sum +
      futuresPnlUsdt({
        side: row.side,
        qty: row.qty,
        entryPrice: row.entryPrice,
        exitPrice: mark,
      })
    );
  }, 0);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 pt-6 pb-8">
      <FuturesFlash
        opened={firstSearchValue(params.paper) === "opened"}
        added={firstSearchValue(params.paper) === "added"}
        closed={firstSearchValue(params.paper) === "closed"}
        liveOpened={firstSearchValue(params.paper) === "live-opened"}
        liveAdded={firstSearchValue(params.paper) === "live-added"}
        liveClosed={firstSearchValue(params.paper) === "live-closed"}
        error={firstSearchValue(params.paperError)}
      />

      <section>
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Snapshot</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Open positions" value={String(open.length)} />
          <StatCard
            label="Unrealized"
            value={open.length === 0 ? "—" : formatSignedUsd(unrealized)}
            toneClass={open.length === 0 ? undefined : signedTone(unrealized)}
          />
          <StatCard
            label="Symbols"
            value={
              open.length === 0
                ? "—"
                : [...new Set(open.map((row) => row.symbol))].join(", ")
            }
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Desk</h2>
            <p className="text-sm text-ink-muted">
              Manual Buy, Sell, and Flatten. Alert automations land on{" "}
              <Link href={FUTURES_PATHS.automations} className="text-accent">
                Automations
              </Link>
              .
            </p>
          </div>
          <Link
            href={FUTURES_PATHS.positions}
            className="text-sm text-accent hover:text-accent-strong"
          >
            Positions
          </Link>
        </div>
        {open.length === 0 ? (
          <p className="rounded-card border border-line bg-surface p-5 text-sm text-ink-muted">
            No open futures on this book. Open from{" "}
            <Link href={FUTURES_PATHS.positions} className="text-accent">
              Positions
            </Link>
            .
          </p>
        ) : (
          <ul className="rounded-card border border-line bg-surface divide-y divide-line">
            {open.map((row) => {
              const mark = markFromTicker(tickers.get(row.symbol) ?? {});
              return (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                >
                  <span className="font-medium">
                    {row.symbol}{" "}
                    <span className="text-ink-muted">
                      {row.side === "long" ? "Long" : "Short"}
                    </span>
                  </span>
                  <span className="tabular-nums text-ink-muted">
                    {row.qty} @ {formatPrice(row.entryPrice)}
                    {mark !== null ? ` · mark ${formatPrice(mark)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  toneClass,
}: {
  label: string;
  value: string;
  toneClass?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <p
        className={`mt-3 text-2xl font-semibold tracking-tight ${toneClass ?? "text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}
