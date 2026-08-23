import type { Metadata } from "next";
import {
  ClosedPaperTrades,
  PaperPerformanceStats,
} from "@/components/paper-blotter";
import { loadPaperDesk } from "@/lib/paper/list";

export const metadata: Metadata = {
  title: "Performance",
  description: "Past paper positions and realized cash-and-carry statistics.",
};

export default async function CashAndCarryPerformancePage() {
  const desk = await loadPaperDesk([]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 pt-6 pb-8">
      <PaperPerformanceStats
        signedIn={desk.signedIn}
        closed={desk.closed}
      />
      <ClosedPaperTrades signedIn={desk.signedIn} closed={desk.closed} />
    </main>
  );
}
