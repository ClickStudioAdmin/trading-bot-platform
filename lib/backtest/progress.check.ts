import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BacktestProgressBanner,
  backtestRunningStatusText,
} from "@/components/backtest-progress-banner";
import {
  backtestProgressLabel,
  backtestProgressPercent,
  backtestRunProgress,
  createBacktestProgressPump,
  parseBacktestProgressCount,
  parseBacktestProgressPhase,
} from "./progress";

assert.equal(parseBacktestProgressPhase("candles"), "candles");
assert.equal(parseBacktestProgressPhase("replay"), "replay");
assert.equal(parseBacktestProgressPhase("done"), null);
assert.equal(parseBacktestProgressCount(12000), 12000);
assert.equal(parseBacktestProgressCount("35"), 35);
assert.equal(parseBacktestProgressCount(-1), null);
assert.equal(parseBacktestProgressCount(null), null);

assert.equal(backtestProgressPercent(0, 35_136), 0);
assert.equal(backtestProgressPercent(12_000, 35_136), 34);
assert.equal(backtestProgressPercent(35_136, 35_136), 100);
assert.equal(backtestProgressPercent(40_000, 35_136), 100);
assert.equal(backtestProgressPercent(1, 0), 0);

const year = {
  status: "running" as const,
  progressDone: 12_000,
  progressTotal: 35_136,
  progressPhase: "candles" as const,
};
const loading = backtestRunProgress(year);
assert.ok(loading);
assert.equal(loading.percent, 34);
assert.equal(loading.stages[0]?.state, "active");
assert.equal(loading.stages[0]?.percent, 34);
assert.equal(loading.stages[1]?.state, "waiting");
assert.equal(loading.stages[1]?.percent, 0);
assert.equal(
  backtestProgressLabel(loading),
  "Loading Candles. 12,000 of 35,136 (34%).",
);
assert.equal(backtestRunningStatusText(loading), "Loading Candles · 34%");
assert.equal(backtestRunningStatusText(null), "Running");
const markup = renderToStaticMarkup(
  createElement(BacktestProgressBanner, { progress: loading }),
);
assert.equal(markup.match(/role="progressbar"/g)?.length, 2);
assert.match(markup, /aria-valuenow="34"/);
assert.match(markup, /aria-valuenow="0"/);
assert.match(markup, /width:34%/);
assert.match(markup, /Loading Candles/);
assert.match(markup, /Replaying/);
assert.match(markup, /Waiting/);
const quiet = renderToStaticMarkup(
  createElement(BacktestProgressBanner, { progress: null }),
);
assert.equal(quiet.includes("progressbar"), false);
assert.match(quiet, /This page refreshes until it finishes/);
assert.equal(
  backtestRunProgress({ ...year, status: "queued" }),
  null,
);
assert.equal(
  backtestRunProgress({ ...year, status: "done" }),
  null,
);
assert.equal(
  backtestRunProgress({ ...year, progressTotal: null }),
  null,
);
const loaded = backtestRunProgress({
  ...year,
  progressDone: 35_136,
  progressPhase: "candles",
});
assert.equal(loaded?.stages[0]?.state, "done");
assert.equal(loaded?.stages[0]?.percent, 100);
assert.equal(loaded?.headline, "Candles loaded");
const replaying = backtestRunProgress({
  ...year,
  progressDone: 12_000,
  progressPhase: "replay",
});
assert.equal(replaying?.phase, "replay");
assert.equal(replaying?.stages[0]?.state, "done");
assert.equal(replaying?.stages[0]?.percent, 100);
assert.equal(replaying?.stages[1]?.percent, 34);
assert.equal(replaying?.percent, 34);
assert.equal(
  replaying ? backtestProgressLabel(replaying) : "",
  "Replaying. 12,000 of 35,136 (34%).",
);
assert.equal(
  replaying ? backtestRunningStatusText(replaying) : "",
  "Replaying · 34%",
);
const replayMarkup = renderToStaticMarkup(
  createElement(BacktestProgressBanner, { progress: replaying }),
);
assert.match(replayMarkup, /Candles loaded/);
assert.match(replayMarkup, /Complete/);
assert.match(replayMarkup, /width:100%/);
assert.match(replayMarkup, /width:34%/);

async function main(): Promise<void> {
  const seen: Array<{ done: number; total: number; phase: string }> = [];
  let releaseFirst = () => {};
  const pump = createBacktestProgressPump(async (input) => {
    seen.push(input);
    if (seen.length === 1) {
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
    }
  });
  pump.report({ done: 0, total: 35_136, phase: "candles" });
  await Promise.resolve();
  pump.report({ done: 1_000, total: 35_136, phase: "candles" });
  pump.report({ done: 3_000, total: 35_136, phase: "candles" });
  releaseFirst();
  await pump.flushed();
  assert.deepEqual(
    seen.map((row) => row.done),
    [0, 3_000],
  );

  pump.report({ done: 35_136, total: 35_136, phase: "candles" });
  pump.report({ done: 12_000, total: 35_040, phase: "replay" });
  await pump.flushed();
  assert.equal(seen.at(-1)?.phase, "replay");
  assert.equal(seen.at(-1)?.done, 12_000);
  assert.equal(seen.at(-1)?.total, 35_040);
  console.log("backtest progress checks passed");
}

void main();
