import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import {
  ClosedPaperTrades,
  PaperDeskStats,
} from "@/components/paper-blotter";
import { persistOpportunities } from "@/lib/opportunities/persist";
import { loadPaperDesk } from "@/lib/paper/list";
import { scanCarryOpportunities } from "@/lib/opportunities/scan";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";

export const metadata: Metadata = {
  title: "Performance",
  description: "Past paper positions and cash-and-carry desk statistics.",
};

export default async function CashAndCarryPerformancePage() {
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
    <main className="mx-auto max-w-6xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Performance" />
      <div className="space-y-6">
        {error ? (
          <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <PaperDeskStats
          signedIn={desk.signedIn}
          open={desk.open}
          closed={desk.closed}
        />
        <ClosedPaperTrades signedIn={desk.signedIn} closed={desk.closed} />
      </div>
    </main>
  );
}
