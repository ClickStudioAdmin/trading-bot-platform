import type { Metadata } from "next";
import Link from "next/link";
import { OpportunityTable } from "@/components/opportunity-table";
import { OpenPaperTrades } from "@/components/paper-blotter";
import { PaperFlash } from "@/components/paper-flash";
import { loadUsableBookShare } from "@/lib/engine/settings";
import { applyUsableBookShare } from "@/lib/opportunities/capacity";
import { LastScan } from "@/components/last-scan";
import { loadOpportunityBook } from "@/lib/opportunities/load";
import { formatPct, formatUsd, signedTone } from "@/lib/opportunities/format";
import { firstSearchValue } from "@/lib/paper/open";
import { getOpportunityPaperProps, loadPaperDesk } from "@/lib/paper/list";

export const metadata: Metadata = {
  title: "Cash and Carry",
  description: "Dated cash-and-carry: live book, top opportunities, and paper desk.",
};

export default async function CashAndCarryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const paper = await getOpportunityPaperProps("/strategies/cash-and-carry");
  const justActed = Boolean(firstSearchValue(params.paper));
  const book = await loadOpportunityBook(justActed ? "stored" : "fresh");
  const raw = book.rows;
  const error = book.error;
  const scannedAtMs = book.scannedAtMs;
  const rows = applyUsableBookShare(raw, await loadUsableBookShare());

  const desk = await loadPaperDesk(rows);

  const topFive = rows.slice(0, 5);
  const aprs = rows
    .map((row) => row.netApr)
    .filter((value): value is number => value !== null);
  const bestApr = aprs.length > 0 ? Math.max(...aprs) : null;
  const positive = rows.filter((row) => row.netBasis > 0).length;
  const negative = rows.filter((row) => row.netBasis < 0).length;
  const capacity = rows.reduce((sum, row) => sum + row.capacityUsdt, 0);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 pt-6 pb-8">
      <PaperFlash
        opened={firstSearchValue(params.paper) === "opened"}
        closed={firstSearchValue(params.paper) === "closed"}
        liveOpened={firstSearchValue(params.paper) === "live-opened"}
        liveAdded={firstSearchValue(params.paper) === "live-added"}
        liveClosed={firstSearchValue(params.paper) === "live-closed"}
        liveUnwinding={firstSearchValue(params.paper) === "live-unwinding"}
        exits={firstSearchValue(params.paper) === "exits"}
        unwinding={firstSearchValue(params.paper) === "unwinding"}
        error={firstSearchValue(params.paperError)}
      />

      {error ? (
        <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 text-xl font-semibold tracking-tight">
          Market snapshot
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Pairs scanned" value={String(rows.length)} />
          <StatCard
            label="Best net APR"
            value={formatPct(bestApr)}
            toneClass={signedTone(bestApr)}
          />
          <StatCard
            label="Positive / negative basis"
            value={`${positive} / ${negative}`}
          />
          <StatCard label="Usable book" value={formatUsd(capacity)} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Top opportunities
            </h2>
            <p className="text-sm text-ink-muted">
              Best five by net APR. Green is a premium; red is a discount.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <LastScan atMs={scannedAtMs} />
            <Link
              href="/strategies/cash-and-carry/opportunities"
              className="mt-1 inline-block text-sm text-accent hover:text-accent-strong"
            >
              All opportunities
            </Link>
          </div>
        </div>
        <OpportunityTable rows={topFive} paper={paper} />
      </section>

      <OpenPaperTrades
        signedIn={desk.signedIn}
        open={desk.open}
        exchangeBook={desk.exchangeBook}
      />

      <p className="text-sm text-ink-faint">
        <Link href="/strategies/cash-and-carry/pairs" className="text-accent">
          Full pair list
        </Link>
        {" · "}
        Live Bybit public books. No API key.
      </p>
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
