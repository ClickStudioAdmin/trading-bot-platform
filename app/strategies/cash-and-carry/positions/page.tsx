import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { OpenPaperTrades } from "@/components/paper-blotter";
import { PaperFlash } from "@/components/paper-flash";
import { persistOpportunities } from "@/lib/opportunities/persist";
import { firstSearchValue } from "@/lib/paper/open";
import { loadPaperDesk } from "@/lib/paper/list";
import { scanCarryOpportunities } from "@/lib/opportunities/scan";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";

export const metadata: Metadata = {
  title: "Current Positions",
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
    <main className="mx-auto max-w-6xl space-y-6 px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Current Positions" />
      {error ? (
        <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <PaperFlash
        opened={firstSearchValue(params.paper) === "opened"}
        closed={firstSearchValue(params.paper) === "closed"}
        exits={firstSearchValue(params.paper) === "exits"}
        unwinding={firstSearchValue(params.paper) === "unwinding"}
        error={firstSearchValue(params.paperError)}
      />
      <OpenPaperTrades
        signedIn={desk.signedIn}
        open={desk.open}
        next="/strategies/cash-and-carry/positions"
        showHeading={false}
      />
    </main>
  );
}
