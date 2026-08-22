import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { OpenPaperTrades } from "@/components/paper-blotter";
import { PaperFlash } from "@/components/paper-flash";
import { persistOpportunities } from "@/lib/opportunities/persist";
import { firstSearchValue } from "@/lib/paper/open";
import { loadPaperDesk } from "@/lib/paper/list";
import { scanCarryOpportunities } from "@/lib/opportunities/scan";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";

export const metadata: Metadata = {
  title: "Positions",
  description: "Open paper cash-and-carry positions.",
};

export default async function CashAndCarryPositionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let rows: ScannedOpportunity[] = [];
  let error: string | null = null;

  try {
    rows = await scanCarryOpportunities();
    await persistOpportunities(rows);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Scan failed";
  }

  const desk = await loadPaperDesk(rows);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <PageHeading overline="Strategies · Cash and carry" title="Positions" />
      <p className="-mt-4 text-sm text-ink-muted">
        Open paper carries. Unrealized includes open and close fees on both
        legs. Close is paper only — no Bybit order.
      </p>
      {error ? (
        <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <PaperFlash
        opened={firstSearchValue(params.paper) === "opened"}
        closed={firstSearchValue(params.paper) === "closed"}
        exits={firstSearchValue(params.paper) === "exits"}
        error={firstSearchValue(params.paperError)}
      />
      <OpenPaperTrades
        signedIn={desk.signedIn}
        open={desk.open}
        next="/strategies/cash-and-carry/positions"
        showHeading={false}
      />
      <p className="text-sm text-ink-faint">
        <Link href="/strategies/cash-and-carry" className="text-accent">
          Overview
        </Link>
        {" · "}
        Past trades and desk stats stay on Overview.
      </p>
    </main>
  );
}
