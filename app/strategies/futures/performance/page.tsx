import type { Metadata } from "next";
import {
  ClosedFuturesTrades,
  FuturesPerformanceStats,
} from "@/components/futures-blotter";
import { loadFuturesDesk } from "@/lib/futures/list";
import { loadFuturesSettings } from "@/lib/futures/settings";

export const metadata: Metadata = {
  title: "Performance",
  description: "Closed USDT perpetual positions and realized statistics.",
};

export default async function FuturesPerformancePage() {
  const desk = await loadFuturesDesk();
  const settings = desk.signedIn ? await loadFuturesSettings() : null;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 pt-6 pb-8">
      <FuturesPerformanceStats
        signedIn={desk.signedIn}
        closed={desk.closed}
        exchangeBook={desk.exchangeBook}
        fallbackLeverage={
          desk.exchangeBook ? null : (settings?.paperLeverage ?? null)
        }
      />
      <ClosedFuturesTrades
        signedIn={desk.signedIn}
        closed={desk.closed}
        webhookNames={desk.webhookNames}
        fallbackLeverage={
          desk.exchangeBook ? null : (settings?.paperLeverage ?? null)
        }
      />
    </main>
  );
}
