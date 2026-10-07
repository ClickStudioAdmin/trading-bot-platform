import assert from "node:assert/strict";
import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import { snapshotDcaRecipe } from "@/lib/templates/recipe";
import {
  backtestVariantChangeLabel,
  backtestVariantsStillRunning,
  completedBacktestVariantIds,
} from "./variant-label";

function recipe(stop: string) {
  const form = new FormData();
  form.set("name", "ETH DCA");
  form.set("symbol", "ETHUSDT");
  form.set("direction", "long");
  form.set("startKind", "immediate");
  form.set("clipSize", "1");
  form.set("sizeUnit", "qty");
  form.set("takeProfitPct", "10");
  form.set("stopLossPct", stop);
  const parsed = parseDcaPlaybookForm(form);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error("expected DCA parse");
  }
  return snapshotDcaRecipe(parsed.config);
}

const base = {
  recipe: recipe("5"),
  leverage: 10,
  startingUsdt: 1000,
  fromMs: Date.UTC(2024, 0, 1),
  toMs: Date.UTC(2025, 0, 1),
};
const next = {
  recipe: recipe("4"),
  leverage: 5,
  startingUsdt: 1000,
  fromMs: Date.UTC(2024, 0, 1),
  toMs: Date.UTC(2025, 0, 1),
};

assert.equal(
  backtestVariantChangeLabel(base, next),
  "Stop 5% → 4% · Leverage 10× → 5×",
);
assert.equal(backtestVariantChangeLabel(base, base), "Same parameters");
assert.equal(
  backtestVariantsStillRunning(
    [
      { id: "root", status: "done" },
      { id: "a", status: "running" },
      { id: "b", status: "queued" },
      { id: "c", status: "failed" },
    ],
    "root",
  ),
  2,
);
assert.equal(
  backtestVariantsStillRunning([{ id: "root", status: "running" }], "root"),
  0,
);

const pending = new Set(["a"]);
const optimistic = new Set(["b"]);
const done = new Set(["a", "b", "c"]);
assert.deepEqual(
  completedBacktestVariantIds({
    primed: false,
    previousPendingIds: pending,
    previousOptimisticIds: optimistic,
    pendingIds: new Set(),
    optimisticIds: new Set(),
    doneIds: done,
  }),
  [],
);
assert.deepEqual(
  completedBacktestVariantIds({
    primed: true,
    previousPendingIds: pending,
    previousOptimisticIds: optimistic,
    pendingIds: new Set(),
    optimisticIds: new Set(),
    doneIds: done,
  }),
  ["a", "b"],
);
assert.deepEqual(
  completedBacktestVariantIds({
    primed: true,
    previousPendingIds: pending,
    previousOptimisticIds: optimistic,
    pendingIds: pending,
    optimisticIds: new Set(["b"]),
    doneIds: done,
  }),
  [],
);

console.log("backtest variant label checks passed");
