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
assert.equal(backtestProgressPercent(35_136, 35_136), 99);
assert.equal(backtestProgressPercent(40_000, 35_136), 99);
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
assert.equal(loading.done, 12_000);
assert.equal(
  backtestProgressLabel(loading),
  "Loading candles. 12,000 of 35,136 (34%).",
);
assert.equal(backtestRunningStatusText(loading), "Running · 34%");
assert.equal(backtestRunningStatusText(null), "Running");
const markup = renderToStaticMarkup(
  createElement(BacktestProgressBanner, { progress: loading }),
);
assert.match(markup, /role="progressbar"/);
assert.match(markup, /aria-valuenow="34"/);
assert.match(markup, /width:34%/);
assert.match(markup, /Loading candles\. 12,000 of 35,136 \(34%\)\./);
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
const replaying = backtestRunProgress({
  ...year,
  progressDone: 35_000,
  progressPhase: "replay",
});
assert.equal(replaying?.phase, "replay");
assert.equal(replaying?.percent, 99);
assert.equal(
  replaying ? backtestProgressLabel(replaying) : "",
  "Replaying. 35,000 of 35,136 (99%).",
);

async function main(): Promise<void> {
  const seen: number[] = [];
  let releaseFirst = () => {};
  const pump = createBacktestProgressPump(async (input) => {
    seen.push(input.done);
    if (seen.length === 1) {
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
    }
  }, 35_136);
  pump.report(0, "candles");
  await Promise.resolve();
  pump.report(1_000, "candles");
  pump.report(3_000, "candles");
  releaseFirst();
  await pump.flushed();
  assert.deepEqual(seen, [0, 3_000]);

  pump.report(40_000, "replay");
  await pump.flushed();
  assert.equal(seen.at(-1), 35_136);
  console.log("backtest progress checks passed");
}

void main();
