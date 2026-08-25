import type { Metadata } from "next";
import {
  ClosedFuturesTrades,
  FuturesPerformanceStats,
} from "@/components/futures-blotter";
import { loadFuturesDesk } from "@/lib/futures/list";

export const metadata: Metadata = {
  title: "Performance",
  description: "Closed USDT perpetual positions and realized statistics.",
};

export default async function FuturesPerformancePage() {
  const desk = await loadFuturesDesk();

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 pt-6 pb-8">
      <FuturesPerformanceStats signedIn={desk.signedIn} closed={desk.closed} />
      <ClosedFuturesTrades signedIn={desk.signedIn} closed={desk.closed} />
    </main>
  );
}
