import type { Metadata } from "next";
import Link from "next/link";
import { OpportunityTable } from "@/components/opportunity-table";
import { PageHeading } from "@/components/page-heading";
import { PaperBlotter } from "@/components/paper-blotter";
import { PaperFlash } from "@/components/paper-flash";
import { persistOpportunities } from "@/lib/opportunities/persist";
import { formatPct, formatUsd, signedTone } from "@/lib/opportunities/format";
import { firstSearchValue } from "@/lib/paper/open";
import { getOpportunityPaperProps, loadPaperDesk } from "@/lib/paper/list";
import { scanCarryOpportunities } from "@/lib/opportunities/scan";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";

export const metadata: Metadata = {
  title: "Cash and carry",
  description: "Dated cash-and-carry: live book, top opportunities, and paper desk.",
};

export default async function CashAndCarryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const paper = await getOpportunityPaperProps("/strategies/cash-and-carry");
  let rows: ScannedOpportunity[] = [];
  let error: string | null = null;

  try {
    rows = await scanCarryOpportunities();
    await persistOpportunities(rows);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Scan failed";
  }

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
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <PageHeading overline="Strategies" title="Cash and carry" />
      <p className="-mt-4 text-sm text-ink-muted">
        Buy the USDT spot, sell the dated future. Top opportunities are a live
        scan. Current and past trades are your paper desk. Open and Close are
        paper only — no Bybit order.
      </p>
      <PaperFlash
        opened={firstSearchValue(params.paper) === "opened"}
        closed={firstSearchValue(params.paper) === "closed"}
        exits={firstSearchValue(params.paper) === "exits"}
        error={firstSearchValue(params.paperError)}
      />

      {error ? (
        <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section>
        <div className="mb-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Market snapshot
          </h2>
          <p className="text-sm text-ink-muted">
            Live Bybit public books. No API key.
          </p>
        </div>
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
          <StatCard label="Book capacity" value={formatUsd(capacity)} />
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
          <Link
            href="/strategies/cash-and-carry/opportunities"
            className="text-sm text-accent hover:text-accent-strong"
          >
            All opportunities
          </Link>
        </div>
        <OpportunityTable rows={topFive} paper={paper} />
      </section>

      <PaperBlotter
        signedIn={desk.signedIn}
        open={desk.open}
        closed={desk.closed}
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
