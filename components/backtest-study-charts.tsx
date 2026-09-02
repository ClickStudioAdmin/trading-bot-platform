"use client";

import { useState } from "react";
import { BacktestEquityPanel } from "@/components/backtest-equity";
import { BacktestInlineChart } from "@/components/backtest-run-view";
import {
  chartIntervalForWindow,
  type BacktestRun,
} from "@/lib/backtest/model";

export function BacktestStudyCharts({ run }: { run: BacktestRun }) {
  const [interval, setInterval] = useState(() =>
    chartIntervalForWindow(run.fromMs, run.toMs, run.interval),
  );
  return (
    <>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Account impact</h2>
        <BacktestEquityPanel
          run={run}
          interval={interval}
          onIntervalChange={setInterval}
        />
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Chart</h2>
        <BacktestInlineChart
          run={run}
          interval={interval}
          onIntervalChange={setInterval}
        />
      </section>
    </>
  );
}
