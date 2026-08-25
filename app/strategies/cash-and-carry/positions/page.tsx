import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { OpenPaperTrades, PaperOpenStats } from "@/components/paper-blotter";
import { PaperFlash } from "@/components/paper-flash";
import { loadUsableBookShare } from "@/lib/engine/settings";
import { applyUsableBookShare } from "@/lib/opportunities/capacity";
import { loadOpportunityBook } from "@/lib/opportunities/load";
import { firstSearchValue } from "@/lib/paper/open";
import { loadPaperDesk } from "@/lib/paper/list";

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
  const book = await loadOpportunityBook("stored");
  const rows = applyUsableBookShare(book.rows, await loadUsableBookShare());
  const desk = await loadPaperDesk(rows);

  return (
    <main className="mx-auto max-w-6xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Current Positions" />
      <div className="space-y-6">
        {book.error ? (
          <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {book.error}
          </p>
        ) : null}
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
        <PaperOpenStats signedIn={desk.signedIn} open={desk.open} />
        <OpenPaperTrades
          signedIn={desk.signedIn}
          open={desk.open}
          next="/strategies/cash-and-carry/positions"
          showHeading={false}
          exchangeBook={desk.exchangeBook}
        />
      </div>
    </main>
  );
}
