import assert from "node:assert/strict";
import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import { snapshotDcaRecipe } from "@/lib/templates/recipe";
import {
  backtestRowIsClaimable,
  canDeleteBacktestRun,
  parseBacktestRunRow,
} from "./store";

function dcaRunRow(symbol: string, venue: string): Record<string, unknown> {
  const form = new FormData();
  form.set("name", "Coin");
  form.set("symbol", symbol);
  form.set("direction", "long");
  form.set("startKind", "immediate");
  form.set("clipSize", "1");
  form.set("sizeUnit", "qty");
  const parsed = parseDcaPlaybookForm(form, venue);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return {
    id: "run-1",
    user_id: "user-1",
    status: "done",
    interval: "60",
    desk_type: "dca",
    venue,
    symbol,
    recipe: snapshotDcaRecipe(parsed.config),
    from_ms: 1,
    to_ms: 2,
    starting_balance_usdt: 1000,
    leverage: 10,
    comparable_symbols: ["SOLUSDT", "ETHUSDT"],
  };
}

const hyperliquid = parseBacktestRunRow(dcaRunRow("ETH", "hyperliquid"));
assert.equal(hyperliquid?.venue, "hyperliquid");
assert.equal(hyperliquid?.symbol, "ETH");
assert.equal(hyperliquid?.recipe.symbol, "ETH");
assert.deepEqual(hyperliquid?.comparableSymbols, ["SOL"]);

const bybit = parseBacktestRunRow(dcaRunRow("ETHUSDT", "bybit"));
assert.equal(bybit?.symbol, "ETHUSDT");
assert.deepEqual(bybit?.comparableSymbols, ["SOLUSDT"]);
assert.equal(bybit?.progressDone, null);
assert.equal(bybit?.progressPhase, null);
const withProgress = parseBacktestRunRow({
  ...dcaRunRow("ETHUSDT", "bybit"),
  progress_done: 12000,
  progress_total: 35136,
  progress_phase: "candles",
});
assert.equal(withProgress?.progressDone, 12000);
assert.equal(withProgress?.progressTotal, 35136);
assert.equal(withProgress?.progressPhase, "candles");

const bybitRecipe = bybit?.recipe;
assert.ok(bybitRecipe);
assert.equal(
  parseBacktestRunRow({
    ...dcaRunRow("ETHUSDT", "bybit"),
    symbol: "ETH",
    recipe: { ...bybitRecipe, symbol: "ETH" },
  }),
  null,
);

const pairOnHyperliquid = parseBacktestRunRow({
  ...dcaRunRow("ETHUSDT", "bybit"),
  venue: "hyperliquid",
  symbol: "ETHUSDT",
});
assert.equal(pairOnHyperliquid?.symbol, "ETH");
assert.equal(pairOnHyperliquid?.venue, "hyperliquid");

assert.equal(canDeleteBacktestRun({ userId: "owner-1" }, "owner-1", false), true);
assert.equal(canDeleteBacktestRun({ userId: "owner-1" }, "other-2", false), false);
assert.equal(canDeleteBacktestRun({ userId: null }, "owner-1", false), false);
assert.equal(canDeleteBacktestRun({ userId: null }, "owner-1", true), true);
assert.equal(canDeleteBacktestRun({ userId: "owner-1" }, "other-2", true), true);

const nowMs = Date.UTC(2026, 9, 16, 5, 30);
const staleMs = 15 * 60_000;
assert.equal(
  backtestRowIsClaimable({
    status: "queued",
    claimedAtMs: null,
    nowMs,
    staleMs,
    bars: 40_000,
    maxBars: 0,
  }),
  true,
);
assert.equal(
  backtestRowIsClaimable({
    status: "running",
    claimedAtMs: nowMs - staleMs - 1,
    nowMs,
    staleMs,
    bars: 35_000,
    maxBars: 0,
  }),
  true,
);
assert.equal(
  backtestRowIsClaimable({
    status: "running",
    claimedAtMs: nowMs - 60_000,
    nowMs,
    staleMs,
    bars: 35_000,
    maxBars: 0,
  }),
  false,
);
assert.equal(
  backtestRowIsClaimable({
    status: "running",
    claimedAtMs: null,
    nowMs,
    staleMs,
    bars: 100,
    maxBars: 0,
  }),
  false,
);
assert.equal(
  backtestRowIsClaimable({
    status: "queued",
    claimedAtMs: null,
    nowMs,
    staleMs,
    bars: 4000,
    maxBars: 3000,
  }),
  false,
);

console.log("backtest store checks passed");
