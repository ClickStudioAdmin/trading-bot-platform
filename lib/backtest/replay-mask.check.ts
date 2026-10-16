import assert from "node:assert/strict";
import { exitExpressionMet } from "@/lib/dca/exit-stack";
import type { DcaFilterSpec } from "@/lib/dca/filters";
import { hardExitMet, hardExitSignalFromJson } from "@/lib/dca/hard-exit";
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";
import type { DcaIndicatorStart } from "@/lib/dca/playbook";
import {
  futuresEntryConditionMet,
  futuresFilterMet,
  perpsExitForSide,
} from "@/lib/futures/conditions";
import type { FuturesSide } from "@/lib/futures/model";
import type { CandleBar } from "@/lib/market/candles";
import type { EntryStack } from "@/lib/strategy/expr";
import type { PerpsTemplateRecipe } from "@/lib/templates/recipe";
import { ReplayBook, type ReplayEntryInput } from "./replay-mask";
import { replayBarsByTimeframe, replayPerpsPriceCross } from "./replay";

const TAPE = "15" as const;
const TIMEFRAMES: DcaIndicatorTimeframe[] = ["15", "60", "D"];

function walk(count: number, startMs: number): CandleBar[] {
  let seed = 2_024_1016;
  let price = 2_500;
  const bars: CandleBar[] = [];
  for (let index = 0; index < count; index += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const swing = ((seed % 1000) / 1000 - 0.5) * 80;
    const wave = Math.sin(index / 11) * 60 + Math.sin(index / 3) * 15;
    const close = Math.max(50, price + swing + wave);
    const high = Math.max(price, close) + (seed % 23) + 1;
    const low = Math.max(1, Math.min(price, close) - (seed % 19) - 1);
    bars.push({
      timeMs: startMs + index * 15 * 60_000,
      open: price,
      high,
      low,
      close,
    });
    price = close;
  }
  return bars;
}

function start(
  kind: DcaIndicatorStart["kind"],
  compare: DcaIndicatorStart["compare"],
  extra: Partial<DcaIndicatorStart> = {},
): DcaIndicatorStart {
  return {
    kind,
    timeframe: "15",
    compare,
    level: null,
    period: null,
    slowPeriod: null,
    ...extra,
  };
}

function filter(
  kind: DcaFilterSpec["kind"],
  compare: DcaFilterSpec["compare"],
  extra: Partial<DcaFilterSpec> = {},
): DcaFilterSpec {
  return {
    kind,
    timeframe: "15",
    compare,
    level: null,
    period: null,
    multiplier: null,
    ...extra,
  };
}

function entry(partial: Partial<ReplayEntryInput> = {}): ReplayEntryInput {
  return {
    side: "long",
    entrySource: "price",
    triggerCompare: "gte",
    triggerPrice: 1,
    indicator: null,
    confirm: null,
    entryStack: null,
    ...partial,
  };
}

function shell(partial: Partial<PerpsTemplateRecipe> = {}): PerpsTemplateRecipe {
  return {
    kind: "perps",
    name: "Mask",
    symbol: "ETHUSDT",
    formAction: "buy",
    orderType: "market",
    sizeUnit: "qty",
    size: "1",
    limitPrice: "",
    entrySource: "price",
    triggerBy: "last",
    triggerCompare: "gte",
    triggerPrice: "1",
    skipIfOpen: true,
    tpsl: null,
    trailing: null,
    direction: "long",
    ...partial,
  };
}

function assertEntry(label: string, bars: CandleBar[], input: ReplayEntryInput): void {
  const nowMs = Date.now();
  const mask = new ReplayBook(bars, TAPE, nowMs).entryMask(input);
  assert.equal(mask.length, bars.length, label);
  let trues = 0;
  for (let index = 0; index < bars.length; index += 1) {
    const price = bars[index]?.close ?? 0;
    const expected = futuresEntryConditionMet({
      rule: {
        entrySource: input.entrySource,
        indicator: input.indicator,
        confirm: input.confirm,
        entryStack: input.entryStack,
        triggerCompare: input.triggerCompare,
        triggerPrice: input.triggerPrice,
      },
      side: input.side,
      price,
      barsByTimeframe: replayBarsByTimeframe(
        bars.slice(0, index + 1),
        TAPE,
        TIMEFRAMES,
      ),
    });
    assert.equal(mask[index], expected, `${label} bar ${index} close ${price}`);
    if (expected) {
      trues += 1;
    }
  }
  console.log(`${label}: ${trues}/${bars.length} true`);
}

function oracleExit(
  recipe: PerpsTemplateRecipe,
  side: FuturesSide,
  price: number,
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>,
): boolean {
  const exit = perpsExitForSide(
    {
      ...recipe,
      exitIf: recipe.exitIf ?? null,
      exitHard: hardExitSignalFromJson(recipe.exitHard),
    },
    side,
  );
  const quotes = { last: price, mark: price, index: price };
  const first = exit.exitHard
    ? hardExitMet({ signal: exit.exitHard, side, prices: quotes })
    : Boolean(exit.exitIf) &&
      futuresFilterMet({
        spec: exit.exitIf,
        side,
        barsByTimeframe,
      });
  return exitExpressionMet({
    first,
    stack: exit.exitStack,
    side,
    price,
    prices: quotes,
    barsByTimeframe,
    firedWebhookId: null,
  });
}

function assertExit(
  label: string,
  bars: CandleBar[],
  recipe: PerpsTemplateRecipe,
  side: FuturesSide,
): void {
  const mask = new ReplayBook(bars, TAPE, Date.now()).exitMask(recipe, side);
  assert.equal(mask.length, bars.length, label);
  let trues = 0;
  for (let index = 0; index < bars.length; index += 1) {
    const price = bars[index]?.close ?? 0;
    const expected = oracleExit(
      recipe,
      side,
      price,
      replayBarsByTimeframe(bars.slice(0, index + 1), TAPE, TIMEFRAMES),
    );
    assert.equal(mask[index], expected, `${label} bar ${index} close ${price}`);
    if (expected) {
      trues += 1;
    }
  }
  console.log(`${label}: ${trues}/${bars.length} true`);
}

function assertBothSides(
  label: string,
  bars: CandleBar[],
  input: ReplayEntryInput,
): void {
  const price = bars.find((bar) => bar.close > 0);
  assert.ok(price);
  const trues = new ReplayBook(bars, TAPE, Date.now())
    .entryMask({ ...input, side: "long" })
    .filter(Boolean).length;
  assertEntry(`${label} long`, bars, { ...input, side: "long" });
  assertEntry(`${label} short`, bars, { ...input, side: "short" });
  assert.ok(trues > 0, `${label} never became true`);
}

async function main(): Promise<void> {
  const bars = walk(480, Date.UTC(2024, 0, 1));
  const book = new ReplayBook(bars, TAPE, Date.now());
  for (const index of [0, 95, 96, 191, bars.length - 1]) {
    const prefix = replayBarsByTimeframe(bars.slice(0, index + 1), TAPE, TIMEFRAMES);
    const raw = book.barsAt(index, TIMEFRAMES);
    for (const timeframe of TIMEFRAMES) {
      assert.deepEqual(
        raw.get(timeframe),
        prefix.get(timeframe),
        `prefix ${timeframe} @${index}`,
      );
    }
  }

  const flat = bars.map((bar) => ({ ...bar, close: 0 }));
  assert.equal(
    new ReplayBook(flat, TAPE, Date.now()).entryMask(entry()).some(Boolean),
    false,
  );

  assertEntry("price gte", bars, entry({ triggerCompare: "gte", triggerPrice: 2_500 }));
  assertEntry("price lte", bars, entry({ triggerCompare: "lte", triggerPrice: 2_500 }));
  assertEntry(
    "webhook source",
    bars,
    entry({ entrySource: "webhook", triggerPrice: 9_999 }),
  );

  const supertrend = entry({
    entrySource: "trend",
    indicator: start("supertrend", "cross_gte", { period: 10, multiplier: 3 }),
  });
  assertBothSides("supertrend cross", bars, supertrend);
  assertEntry(
    "supertrend sit",
    bars,
    entry({
      entrySource: "trend",
      indicator: start("supertrend", "lte", { period: 10, multiplier: 3 }),
    }),
  );

  assertBothSides(
    "rsi gte",
    bars,
    entry({
      entrySource: "indicator",
      indicator: start("rsi", "gte", { level: 55, period: 14 }),
    }),
  );
  assertBothSides(
    "rsi cross",
    bars,
    entry({
      entrySource: "indicator",
      indicator: start("rsi", "cross_lte", { level: 45, period: 14 }),
    }),
  );
  assertBothSides(
    "macd gte",
    bars,
    entry({
      entrySource: "indicator",
      indicator: start("macd", "gte", { level: 0 }),
    }),
  );
  assertBothSides(
    "ema cross",
    bars,
    entry({
      entrySource: "indicator",
      indicator: start("ema", "cross_gte", { period: 12 }),
    }),
  );
  assertBothSides(
    "sma sit",
    bars,
    entry({
      entrySource: "indicator",
      indicator: start("sma", "lte", { period: 20 }),
    }),
  );
  assertBothSides(
    "bb cross",
    bars,
    entry({
      entrySource: "indicator",
      indicator: start("bb", "cross_gte", { period: 20 }),
    }),
  );
  assertBothSides(
    "ema pair",
    bars,
    entry({
      entrySource: "indicator",
      indicator: start("ema_cross", "cross_gte", { period: 8, slowPeriod: 21 }),
    }),
  );
  assertBothSides(
    "ema level cross",
    bars,
    entry({
      entrySource: "indicator",
      indicator: start("ema_cross", "cross_gte", { level: 2_500, period: 8, slowPeriod: 21 }),
    }),
  );
  assertBothSides(
    "atr band",
    bars,
    entry({
      entrySource: "indicator",
      indicator: start("atr_band", "gte", { period: 14, multiplier: 2 }),
    }),
  );

  const stack: EntryStack = {
    joins: ["and", "or"],
    leaves: [
      { kind: "filter", spec: filter("rsi", "gte", { level: 30, period: 14 }) },
      { kind: "price", triggerBy: "last", compare: "gte", price: 2_400 },
    ],
  };
  assertBothSides(
    "and or stack",
    bars,
    entry({
      entrySource: "trend",
      indicator: start("supertrend", "cross_gte", { period: 10, multiplier: 3 }),
      entryStack: stack,
    }),
  );
  assertEntry(
    "webhook leaf stays false",
    bars,
    entry({
      triggerPrice: 1,
      entryStack: {
        joins: ["and"],
        leaves: [{ kind: "webhook", webhookId: "hook" }],
      },
    }),
  );
  assertEntry(
    "confirm filter",
    bars,
    entry({
      triggerPrice: 1,
      confirm: filter("bb", "inside", { period: 20 }),
    }),
  );
  assertEntry(
    "rsi between",
    bars,
    entry({
      triggerPrice: 1,
      confirm: filter("rsi", "between", { level: 40, levelTo: 60, period: 14 }),
    }),
  );

  const openNow = Date.now();
  const openBars = walk(200, Date.UTC(2024, 0, 1));
  openBars.push({
    timeMs: openNow,
    open: 2_500,
    high: 2_600,
    low: 2_400,
    close: 2_550,
  });
  assertEntry(
    "open 15m bar",
    openBars,
    entry({
      entrySource: "indicator",
      indicator: start("rsi", "gte", { level: 50, period: 14 }),
    }),
  );

  const dailyBars = walk(96, openNow);
  assertExit(
    "open daily supertrend",
    dailyBars,
    shell({
      exitIf: filter("supertrend", "lte", { timeframe: "D", period: 3, multiplier: 2 }),
    }),
    "long",
  );

  const daily = walk(96 * 16, Date.UTC(2024, 0, 1));
  assertExit(
    "daily supertrend exit",
    daily,
    shell({
      exitIf: filter("supertrend", "lte", { timeframe: "D", period: 5, multiplier: 2 }),
    }),
    "long",
  );
  assertExit(
    "exit stack raw rsi or price",
    bars,
    shell({
      exitIf: filter("rsi", "gte", { level: 80, period: 14 }),
      exitStack: {
        joins: ["or", "and"],
        leaves: [
          { kind: "filter", spec: filter("macd", "gte", { level: 0 }) },
          { kind: "price", triggerBy: "last", compare: "lte", price: 2_200 },
        ],
      },
    }),
    "short",
  );
  assertExit(
    "hard price exit",
    bars,
    shell({
      exitHard: {
        trigger: "price",
        triggerBy: "last",
        compare: "gte",
        price: 2_800,
      },
    }),
    "long",
  );
  assertExit("empty exit", bars, shell(), "long");
  const shortExit = shell({
    direction: "both",
    shortEntry: {
      entrySource: "price",
      webhookId: null,
      triggerBy: "last",
      triggerCompare: "lte",
      triggerPrice: 1,
      skipIfOpen: true,
      indicator: null,
      confirm: null,
      entryStack: { leaves: [], joins: [] },
      exitIf: filter("rsi", "gte", { level: 60, period: 14 }),
    },
  });
  assertExit("short leg exit", bars, shortExit, "short");
  assertExit("long keeps the shared exit", bars, shortExit, "long");

  const longRun = walk(20_000, Date.UTC(2024, 0, 1));
  const started = Date.now();
  const replay = await replayPerpsPriceCross({
    bars: longRun,
    feeRate: 0.0006,
    startingUsdt: 10_000,
    leverage: 10,
    recipe: shell({
      name: "Rule 1",
      symbol: "ETHUSDT",
      sizeUnit: "usdt",
      size: "1000",
      entrySource: "trend",
      direction: "both",
      indicator: start("supertrend", "cross_gte", { period: 10, multiplier: 3 }),
      entryStack: stack,
      exitIf: filter("supertrend", "lte", { timeframe: "D", period: 10, multiplier: 3 }),
      tpsl: {
        takeProfit: 5,
        stopLoss: 4,
        tpKind: "percent",
        slKind: "percent",
        tpTrigger: "last",
        slTrigger: "last",
        mode: "full",
        tpQty: null,
        slQty: null,
        tpOrderType: "market",
        slOrderType: "market",
        tpLimitPrice: null,
        slLimitPrice: null,
      },
      shortEntry: {
        entrySource: "price",
        webhookId: null,
        triggerBy: "last",
        triggerCompare: "lte",
        triggerPrice: 3_000,
        skipIfOpen: true,
        indicator: null,
        confirm: null,
        entryStack: {
          joins: ["and", "and"],
          leaves: [
            {
              kind: "indicator",
              start: start("rsi", "cross_gte", { level: 70, period: 14 }),
            },
            {
              kind: "indicator",
              start: start("macd", "gte", { level: 0 }),
            },
          ],
        },
      },
    }),
  });
  const elapsed = Date.now() - started;
  console.log(
    `20k both replay: ${elapsed}ms orders ${replay.orders.length} trades ${replay.stats.trades}`,
  );
  assert.ok(elapsed < 5_000, `20k replay took ${elapsed}ms`);
  assert.ok(replay.orders.length >= 0);
  assert.equal(typeof replay.stats.trades, "number");
}

void main();
