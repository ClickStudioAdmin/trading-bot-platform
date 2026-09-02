"use client";

import { useState } from "react";
import { BacktestEquityPanel } from "@/components/backtest-equity";
import { BacktestInlineChart } from "@/components/backtest-run-view";
import {
  chartIntervalForWindow,
  type BacktestRun,
} from "@/lib/backtest/model";

export function BacktestStudyCharts({ run }: { run: BacktestRun }) {
  const defaultInterval = () =>
    chartIntervalForWindow(run.fromMs, run.toMs, run.interval);
  const [equityInterval, setEquityInterval] = useState(defaultInterval);
  const [chartInterval, setChartInterval] = useState(defaultInterval);
  return (
    <>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Account impact</h2>
        <BacktestEquityPanel
          run={run}
          interval={equityInterval}
          onIntervalChange={setEquityInterval}
        />
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Chart</h2>
        <BacktestInlineChart
          run={run}
          interval={chartInterval}
          onIntervalChange={setChartInterval}
        />
      </section>
    </>
  );
}
