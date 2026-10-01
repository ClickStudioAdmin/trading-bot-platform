/**
 * Maximise account profit for the 10-year ETH long and short winners.
 *
 * The signals stay the 10-year winners. This pass changes how much of the
 * cash book the ladder uses, the take profit, the stop, and the dip ladder.
 *
 * Run: npx tsx lib/backtest/eth-dca-account-max.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import { snapshotDcaRecipe, type DcaTemplateRecipe } from "@/lib/templates/recipe";
import type { CandleBar } from "@/lib/market/candles";
import {
  BACKTEST_FEE_PRESETS,
  DEFAULT_LEVERAGE,
  DEFAULT_STARTING_USDT,
  backtestAprPct,
  type BacktestStats,
  type SimulatedOrder,
} from "@/lib/backtest/model";
import { replayDcaPlaybook } from "@/lib/backtest/replay-dca";
import {
  ENTRIES,
  EXITS,
  SECONDARIES,
  buildRecipe,
  type EntrySpec,
  type ExitSpec,
  type SecondarySpec,
} from "@/lib/backtest/eth-dca-sweep";

const RESULTS_PATH = "docs/dca-eth-account-max.md";
const CACHE_PATH = "/tmp/eth-usd-6h-2016.json";
const TIMEFRAME = "360";
const VENUE = "bybit" as const;
const SYMBOL = "ETHUSDT";
const FROM_MS = Date.parse("2016-10-01T00:00:00Z");
const TO_MS = Date.parse("2026-10-01T00:00:00Z");
const BASELINE_REALIZED = 1369.41;

const SIZES: SizeSpec[] = [
  { kind: "percent", value: 4 },
  { kind: "percent", value: 25 },
  { kind: "percent", value: 50 },
  { kind: "percent", value: 100 },
  { kind: "margin", value: 10 },
  { kind: "margin", value: 20 },
  { kind: "margin", value: 30 },
  { kind: "margin", value: 40 },
  { kind: "margin", value: 60 },
  { kind: "margin", value: 80 },
];

const TAKE_PROFITS = ["1", "2", "3", "5", "8"];
const STOP_LOSSES = ["3", "5", "8", "12"];
const CLIPS = [1, 2, 4, 8];
const DIPS = [0.5, 1, 2, 3];

type SizeKind = "percent" | "margin";
type SideName = "long" | "short" | "both";

type SizeSpec = {
  kind: SizeKind;
  value: number;
};

type Row = {
  stage: string;
  label: string;
  side: SideName;
  sizeKind: SizeKind;
  sizeValue: number;
  tp: string;
  sl: string;
  orderType: "market" | "limit";
  clips: number;
  dip: number;
  extra: string;
  realized: number;
  ending: number;
  drawdown: number;
  trades: number;
  wins: number;
  apy: number | null;
  liquidated: boolean;
};

const shortEma: EntrySpec = {
  id: "ema-xb",
  name: "Price crosses below EMA 21",
  startKind: "indicator",
  kind: "ema",
  compare: "cross_lte",
  period: "21",
};

const shortSupertrend: EntrySpec = {
  id: "st-tr",
  name: "Supertrend turns bearish",
  startKind: "trend",
  kind: "supertrend",
  compare: "cross_lte",
  period: "10",
  mult: "3",
};

function findById<T extends { id: string }>(rows: T[], id: string): T {
  const row = rows.find((item) => item.id === id);
  if (!row) {
    throw new Error(`Missing ${id}`);
  }
  return row;
}

function usd(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function dollars(value: number): string {
  return `$${Math.abs(value).toFixed(2)}`;
}

function pct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${(Math.abs(value) * 100).toFixed(2)}%`;
}

function sizeLabel(kind: SizeKind, value: number): string {
  return kind === "margin" ? `${value}% of margin` : `${value}% of account`;
}

function notionalMultiple(kind: SizeKind, value: number): number {
  const fraction = kind === "margin" ? (value / 100) * DEFAULT_LEVERAGE : value / 100;
  return fraction / 0.04;
}

function better(left: Row, right: Row): Row {
  if (left.liquidated !== right.liquidated) {
    return left.liquidated ? right : left;
  }
  if (right.realized !== left.realized) {
    return right.realized > left.realized ? right : left;
  }
  if (right.drawdown !== left.drawdown) {
    return right.drawdown < left.drawdown ? right : left;
  }
  return right.trades > left.trades ? right : left;
}

function bestOf(rows: Row[], accept: (row: Row) => boolean = () => true): Row | null {
  let best: Row | null = null;
  for (const row of rows) {
    if (!accept(row)) {
      continue;
    }
    best = best ? better(best, row) : row;
  }
  return best;
}

async function loadBars(): Promise<CandleBar[]> {
  try {
    const cached = JSON.parse(readFileSync(CACHE_PATH, "utf8")) as CandleBar[];
    if (Array.isArray(cached) && cached.length > 10_000) {
      console.log(`Cached tape ${cached.length} bars`);
      return cached;
    }
  } catch {
    // Fetch when the cache is missing.
  }
  const stepMs = 250 * 6 * 60 * 60 * 1000;
  const byTime = new Map<number, CandleBar>();
  let cursor = FROM_MS;
  while (cursor < TO_MS) {
    const chunkEnd = Math.min(TO_MS, cursor + stepMs);
    const url = new URL("https://api.exchange.coinbase.com/products/ETH-USD/candles");
    url.searchParams.set("granularity", "21600");
    url.searchParams.set("start", new Date(cursor).toISOString());
    url.searchParams.set("end", new Date(chunkEnd).toISOString());
    let body: unknown = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await fetch(url);
      if (response.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
        continue;
      }
      body = await response.json();
      if (!response.ok || !Array.isArray(body)) {
        throw new Error(`Coinbase ${response.status} ${JSON.stringify(body).slice(0, 180)}`);
      }
      break;
    }
    if (!Array.isArray(body)) {
      throw new Error("Coinbase did not return candles.");
    }
    for (const row of body) {
      if (!Array.isArray(row)) {
        continue;
      }
      const timeMs = Number(row[0]) * 1000;
      const low = Number(row[1]);
      const high = Number(row[2]);
      const open = Number(row[3]);
      const close = Number(row[4]);
      if (!(timeMs >= FROM_MS && timeMs < TO_MS && close > 0)) {
        continue;
      }
      byTime.set(timeMs, { timeMs, open, high, low, close });
    }
    cursor = chunkEnd;
  }
  const bars = [...byTime.values()].sort((a, b) => a.timeMs - b.timeMs);
  writeFileSync(CACHE_PATH, JSON.stringify(bars));
  console.log(`Fetched tape ${bars.length} bars`);
  return bars;
}

function setIndicator(form: FormData, side: "long" | "short", entry: EntrySpec): void {
  const prefix = side === "short" ? "shortIndicator" : "indicator";
  form.set(`${prefix}Kind`, entry.kind);
  form.set(`${prefix}Timeframe`, TIMEFRAME);
  form.set(`${prefix}Compare`, entry.compare);
  if (entry.level != null) {
    form.set(`${prefix}Level`, entry.level);
  }
  if (entry.period != null) {
    form.set(`${prefix}Period`, entry.period);
  }
  if (entry.slow != null) {
    form.set(`${prefix}SlowPeriod`, entry.slow);
  }
  if (entry.mult != null) {
    form.set(`${prefix}Multiplier`, entry.mult);
  }
}

function setSecondary(
  form: FormData,
  prefix: "confirm" | "shortConfirm",
  secondary: SecondarySpec,
): void {
  form.set(`${prefix}Kind`, secondary.kind);
  form.set(`${prefix}Timeframe`, TIMEFRAME);
  form.set(`${prefix}Compare`, secondary.compare);
  if (secondary.period) {
    form.set(`${prefix}Period`, secondary.period);
  }
  if (secondary.level != null) {
    form.set(`${prefix}Level`, secondary.level);
  }
  if (secondary.mult != null) {
    form.set(`${prefix}Multiplier`, secondary.mult);
  }
}

function bothRecipe(input: {
  longEntry: EntrySpec;
  shortEntry: EntrySpec;
  longSecondary: SecondarySpec;
  shortSecondary: SecondarySpec;
  size: SizeSpec;
  tp: string;
  sl: string;
  orderType: "market" | "limit";
  clips: number;
  dip: number;
  sizeMultiplier?: string;
  breakeven?: boolean;
}): DcaTemplateRecipe {
  const form = new FormData();
  form.set("name", "acct both");
  form.set("deskVenue", VENUE);
  form.set("symbol", SYMBOL);
  form.set("direction", "both");
  form.set("startKind", input.longEntry.startKind);
  setIndicator(form, "long", input.longEntry);
  setIndicator(form, "short", input.shortEntry);
  setSecondary(form, "confirm", input.longSecondary);
  setSecondary(form, "shortConfirm", input.shortSecondary);
  form.set("clipSize", "100");
  form.set("sizeUnit", "usdt");
  form.set("averaging", "dip");
  form.set("restGrid", "1");
  form.set("dipPct", String(input.dip));
  form.set("maxClips", String(input.clips));
  form.set("maxValueKind", input.size.kind);
  form.set("maxValue", String(input.size.value));
  form.set("accountBookUsdt", String(DEFAULT_STARTING_USDT));
  form.set("accountLeverage", String(DEFAULT_LEVERAGE));
  form.set("spacingKind", "percent");
  form.set("sizeMultiplier", input.sizeMultiplier ?? "1");
  form.set("deviationMultiplier", "1");
  form.set("takeProfitKind", "percent");
  form.set("takeProfitPct", input.tp);
  form.set("takeProfitBasis", "average");
  form.set("takeProfitOrderType", input.orderType);
  form.set("stopLossPct", input.sl);
  form.set("stopLossBasis", "average");
  form.set("stopLossOrderType", "market");
  if (input.breakeven) {
    form.set("breakevenActivationPct", "1");
    form.set("breakevenOffsetPct", "0");
  }
  const parsed = parseDcaPlaybookForm(form, VENUE);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return snapshotDcaRecipe(parsed.config);
}

function sideRecipe(
  entry: EntrySpec,
  exit: ExitSpec,
  secondary: SecondarySpec,
  side: "long" | "short",
  size: SizeSpec,
  clips: number,
  dip: number,
): DcaTemplateRecipe {
  return buildRecipe(entry, exit, secondary, {
    timeframe: TIMEFRAME,
    venue: VENUE,
    symbol: SYMBOL,
    direction: side,
    bookUsdt: DEFAULT_STARTING_USDT,
    name: "acct side",
    maxValueKind: size.kind,
    maxValue: String(size.value),
    maxClips: String(clips),
    dipPct: String(dip),
  });
}

async function replay(
  bars: CandleBar[],
  recipe: DcaTemplateRecipe,
  fromMs: number,
  toMs: number,
  spec: Omit<Row, "realized" | "ending" | "drawdown" | "trades" | "wins" | "apy" | "liquidated">,
): Promise<Row> {
  const started = Date.now();
  const result = await replayDcaPlaybook({
    bars,
    recipe,
    feeRate: BACKTEST_FEE_PRESETS.vip0_taker.rate,
    startingUsdt: DEFAULT_STARTING_USDT,
    leverage: DEFAULT_LEVERAGE,
    venue: VENUE,
  });
  const row = toRow(result.orders, result.stats, fromMs, toMs, spec);
  console.log(
    `${spec.stage} ${spec.label} net ${row.realized.toFixed(2)} dd ${row.drawdown.toFixed(0)} trades ${row.trades} liq ${row.liquidated ? "yes" : "no"} ${Date.now() - started}ms`,
  );
  return row;
}

function toRow(
  orders: SimulatedOrder[],
  stats: BacktestStats,
  fromMs: number,
  toMs: number,
  spec: Omit<Row, "realized" | "ending" | "drawdown" | "trades" | "wins" | "apy" | "liquidated">,
): Row {
  const liquidated =
    stats.endingUsdt <= 0 || orders.some((order) => order.reason === "liquidation");
  return {
    ...spec,
    realized: stats.realizedUsdt,
    ending: stats.endingUsdt,
    drawdown: stats.maxDrawdownUsdt,
    trades: stats.trades,
    wins: stats.wins,
    apy: liquidated
      ? null
      : backtestAprPct(stats.realizedUsdt, DEFAULT_STARTING_USDT, fromMs, toMs),
    liquidated,
  };
}

function exitText(row: Row): string {
  if (row.tp.startsWith("ATR")) {
    return `${row.tp}, stop ${row.sl}%`;
  }
  return `TP ${row.tp}% ${row.orderType}, stop ${row.sl}%`;
}

function describe(row: Row): string {
  const extra = row.extra ? `, ${row.extra}` : "";
  return `${row.side}, ${sizeLabel(row.sizeKind, row.sizeValue)}, ${exitText(row)}, ${row.clips} clips, ${row.dip}% dip${extra}`;
}

function table(rows: Row[]): string {
  const lines = [
    "| Size | Exit | Ladder | Realized | Ending | APY | Max DD | Trades | Liquidated |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const row of rows) {
    const exit = row.tp.startsWith("ATR")
      ? `${row.tp} / SL ${row.sl}%`
      : `TP ${row.tp}% ${row.orderType} / SL ${row.sl}%`;
    const ladder = `${row.clips} × ${row.dip}%${row.extra ? ` ${row.extra}` : ""}`;
    lines.push(
      `| ${sizeLabel(row.sizeKind, row.sizeValue)} | ${exit} | ${ladder} | ${usd(row.realized)} | ${dollars(row.ending)} | ${pct(row.apy)} | ${dollars(row.drawdown)} | ${row.trades} | ${row.liquidated ? "yes" : "no"} |`,
    );
  }
  return lines.join("\n");
}

function render(input: {
  bars: number;
  from: string;
  to: string;
  baseline: Row;
  best: Row;
  calm: Row | null;
  busy: Row | null;
  sizeBest: Row;
  top: Row[];
  liquidated: Row[];
  sides: Row[];
  signals: Row[];
  probes: Row[];
}): string {
  const scale = input.best.realized / input.baseline.realized;
  const notional = notionalMultiple(input.best.sizeKind, input.best.sizeValue);
  const lines: string[] = [];
  lines.push("# Account profit on the 10-year ETH book");
  lines.push("");
  lines.push(
    `The combined bot from [dca-eth-sweep-10y.md](dca-eth-sweep-10y.md) made ${usd(input.baseline.realized)} because each new cycle used 4% of the cash book as notional. This pass keeps those signals and changes the size, the take profit, the stop, and the dip ladder. Tape is Coinbase ETH-USD 6h, ${input.from} to ${input.to} (${input.bars} bars), $10,000, 10×, 6 bps. Percent of account sets notional to cash book × percent. Percent of margin sets notional to cash book × leverage × percent, so 10% of margin matches 100% of account. A liquidated run is not a winner.`,
  );
  lines.push("");
  lines.push("## Best account result");
  lines.push("");
  lines.push(
    `**Realized ${usd(input.best.realized)}. Ending equity ${dollars(input.best.ending)}. APY ${pct(input.best.apy)}.** Max drawdown ${dollars(input.best.drawdown)}. ${input.best.trades.toLocaleString("en-US")} closed trades. ${input.best.liquidated ? "Liquidated." : "Not liquidated."}`,
  );
  lines.push("");
  lines.push(`Settings: ${describe(input.best)}.`);
  lines.push("");
  lines.push(
    `That is ${scale.toFixed(2)}× the +$1,369.41 baseline. Full-ladder notional is ${notional.toFixed(1)}× the baseline 4% ladder. ${
      input.best.side === "both"
        ? "The long side is still price crossing above SMA 21 with price inside the Bollinger bands. The short side is still price crossing below EMA 21 with price above SMA 21."
        : `This result is ${input.best.side} only${input.best.extra ? ` (${input.best.extra})` : ""}.`
    }`,
  );
  lines.push("");
  if (input.calm && input.calm !== input.best) {
    lines.push(
      `Highest realized with max drawdown at or under 25% of the $10,000 start: ${usd(input.calm.realized)}, APY ${pct(input.calm.apy)}, drawdown ${dollars(input.calm.drawdown)}. Settings: ${describe(input.calm)}.`,
    );
    lines.push("");
  }
  if (input.busy && input.busy !== input.best) {
    lines.push(
      `Highest realized with at least 100 trades: ${usd(input.busy.realized)}, APY ${pct(input.busy.apy)}, ${input.busy.trades} trades. Settings: ${describe(input.busy)}.`,
    );
    lines.push("");
  }
  lines.push("## Size on the original 2% take profit and 5% stop");
  lines.push("");
  lines.push(
    `Holding the original exit, clips, and dip, the best surviving size was ${describe(input.sizeBest)} at ${usd(input.sizeBest.realized)}. Larger ladders make more dollars only while the stop still fires before the account is wiped.`,
  );
  lines.push("");
  lines.push("## Top surviving settings");
  lines.push("");
  lines.push(table(input.top));
  lines.push("");
  if (input.liquidated.length > 0) {
    lines.push("## Sizes that liquidated");
    lines.push("");
    lines.push(table(input.liquidated.slice(0, 8)));
    lines.push("");
  }
  lines.push("## Long only, short only, and other signals");
  lines.push("");
  lines.push(
    "Long only and short only use the winning size, exit, and ladder. The other rows keep that size and use the next-best fixed-clip signals from the 10-year study, with their own exits.",
  );
  lines.push("");
  lines.push(table([...input.sides, ...input.signals]));
  lines.push("");
  if (input.probes.length > 0) {
    lines.push("## Limit orders, breakeven, and a larger later clip");
    lines.push("");
    lines.push(table(input.probes));
    lines.push("");
  }
  lines.push(
    "Paper fills on this Coinbase tape only. These runs are not saved on the admin account, because that chart would reload Hyperliquid or Bybit candles and would not match this tape.",
  );
  lines.push("");
  return lines.join("\n");
}

async function main(): Promise<void> {
  const bars = await loadBars();
  const first = bars[0];
  const last = bars[bars.length - 1];
  if (!first || !last || bars.length < 10_000) {
    throw new Error(`Tape too short: ${bars.length} bars.`);
  }
  const longEntry = findById(ENTRIES, "sma-xa");
  const longSecondary = findById(SECONDARIES, "bb-inside");
  const shortSecondary = findById(SECONDARIES, "sma-above");
  const rows: Row[] = [];

  const baseline = await replay(
    bars,
    bothRecipe({
      longEntry,
      shortEntry: shortEma,
      longSecondary,
      shortSecondary,
      size: { kind: "percent", value: 4 },
      tp: "2",
      sl: "5",
      orderType: "market",
      clips: 4,
      dip: 1,
    }),
    first.timeMs,
    last.timeMs,
    {
      stage: "baseline",
      label: "4% tp2 sl5",
      side: "both",
      sizeKind: "percent",
      sizeValue: 4,
      tp: "2",
      sl: "5",
      orderType: "market",
      clips: 4,
      dip: 1,
      extra: "",
    },
  );
  if (Math.abs(baseline.realized - BASELINE_REALIZED) > 1) {
    throw new Error(
      `Baseline realized ${baseline.realized.toFixed(2)} did not match ${BASELINE_REALIZED.toFixed(2)}.`,
    );
  }
  rows.push(baseline);

  for (const size of SIZES) {
    for (const tp of TAKE_PROFITS) {
      for (const sl of STOP_LOSSES) {
        if (size.kind === "percent" && size.value === 4 && tp === "2" && sl === "5") {
          continue;
        }
        rows.push(
          await replay(
            bars,
            bothRecipe({
              longEntry,
              shortEntry: shortEma,
              longSecondary,
              shortSecondary,
              size,
              tp,
              sl,
              orderType: "market",
              clips: 4,
              dip: 1,
            }),
            first.timeMs,
            last.timeMs,
            {
              stage: "grid",
              label: `${size.kind}${size.value} tp${tp} sl${sl}`,
              side: "both",
              sizeKind: size.kind,
              sizeValue: size.value,
              tp,
              sl,
              orderType: "market",
              clips: 4,
              dip: 1,
              extra: "",
            },
          ),
        );
      }
    }
  }

  const gridBest = bestOf(rows, (row) => !row.liquidated);
  if (!gridBest) {
    throw new Error("Every grid run liquidated.");
  }

  for (const clips of CLIPS) {
    for (const dip of DIPS) {
      if (clips === gridBest.clips && dip === gridBest.dip) {
        continue;
      }
      rows.push(
        await replay(
          bars,
          bothRecipe({
            longEntry,
            shortEntry: shortEma,
            longSecondary,
            shortSecondary,
            size: { kind: gridBest.sizeKind, value: gridBest.sizeValue },
            tp: gridBest.tp,
            sl: gridBest.sl,
            orderType: "market",
            clips,
            dip,
          }),
          first.timeMs,
          last.timeMs,
          {
            stage: "ladder",
            label: `clips${clips} dip${dip}`,
            side: "both",
            sizeKind: gridBest.sizeKind,
            sizeValue: gridBest.sizeValue,
            tp: gridBest.tp,
            sl: gridBest.sl,
            orderType: "market",
            clips,
            dip,
            extra: "",
          },
        ),
      );
    }
  }

  const ladderBest =
    bestOf(
      rows.filter(
        (row) =>
          row.tp === gridBest.tp &&
          row.sl === gridBest.sl &&
          row.sizeKind === gridBest.sizeKind &&
          row.sizeValue === gridBest.sizeValue &&
          row.orderType === "market" &&
          row.extra === "",
      ),
      (row) => !row.liquidated,
    ) ?? gridBest;

  for (const size of SIZES) {
    if (size.kind === ladderBest.sizeKind && size.value === ladderBest.sizeValue) {
      continue;
    }
    const already = rows.some(
      (row) =>
        row.side === "both" &&
        row.sizeKind === size.kind &&
        row.sizeValue === size.value &&
        row.tp === ladderBest.tp &&
        row.sl === ladderBest.sl &&
        row.orderType === "market" &&
        row.clips === ladderBest.clips &&
        row.dip === ladderBest.dip &&
        row.extra === "",
    );
    if (already) {
      continue;
    }
    rows.push(
      await replay(
        bars,
        bothRecipe({
          longEntry,
          shortEntry: shortEma,
          longSecondary,
          shortSecondary,
          size,
          tp: ladderBest.tp,
          sl: ladderBest.sl,
          orderType: "market",
          clips: ladderBest.clips,
          dip: ladderBest.dip,
        }),
        first.timeMs,
        last.timeMs,
        {
          stage: "resize",
          label: `${size.kind}${size.value} ladder`,
          side: "both",
          sizeKind: size.kind,
          sizeValue: size.value,
          tp: ladderBest.tp,
          sl: ladderBest.sl,
          orderType: "market",
          clips: ladderBest.clips,
          dip: ladderBest.dip,
          extra: "",
        },
      ),
    );
  }

  const best = bestOf(rows, (row) => !row.liquidated) ?? baseline;
  const percentExit = sideExit(best.tp, best.sl, "market");
  const sides: Row[] = [];
  for (const side of ["long", "short"] as const) {
    const entry = side === "long" ? longEntry : shortEma;
    const secondary = side === "long" ? longSecondary : shortSecondary;
    sides.push(
      await replay(
        bars,
        sideRecipe(
          entry,
          percentExit,
          secondary,
          side,
          { kind: best.sizeKind, value: best.sizeValue },
          best.clips,
          best.dip,
        ),
        first.timeMs,
        last.timeMs,
        {
          stage: "side",
          label: side,
          side,
          sizeKind: best.sizeKind,
          sizeValue: best.sizeValue,
          tp: best.tp,
          sl: best.sl,
          orderType: "market",
          clips: best.clips,
          dip: best.dip,
          extra: "",
        },
      ),
    );
  }

  const signals = await signalProbes(
    bars,
    first.timeMs,
    last.timeMs,
    { kind: best.sizeKind, value: best.sizeValue },
  );

  const probes: Row[] = [];
  probes.push(
    await replay(
      bars,
      bothRecipe({
        longEntry,
        shortEntry: shortEma,
        longSecondary,
        shortSecondary,
        size: { kind: best.sizeKind, value: best.sizeValue },
        tp: best.tp,
        sl: best.sl,
        orderType: "limit",
        clips: best.clips,
        dip: best.dip,
      }),
      first.timeMs,
      last.timeMs,
      {
        stage: "probe",
        label: "limit",
        side: "both",
        sizeKind: best.sizeKind,
        sizeValue: best.sizeValue,
        tp: best.tp,
        sl: best.sl,
        orderType: "limit",
        clips: best.clips,
        dip: best.dip,
        extra: "",
      },
    ),
  );
  probes.push(
    await replay(
      bars,
      bothRecipe({
        longEntry,
        shortEntry: shortEma,
        longSecondary,
        shortSecondary,
        size: { kind: best.sizeKind, value: best.sizeValue },
        tp: best.tp,
        sl: best.sl,
        orderType: "market",
        clips: best.clips,
        dip: best.dip,
        breakeven: true,
      }),
      first.timeMs,
      last.timeMs,
      {
        stage: "probe",
        label: "breakeven",
        side: "both",
        sizeKind: best.sizeKind,
        sizeValue: best.sizeValue,
        tp: best.tp,
        sl: best.sl,
        orderType: "market",
        clips: best.clips,
        dip: best.dip,
        extra: "breakeven at 1%",
      },
    ),
  );
  probes.push(
    await replay(
      bars,
      bothRecipe({
        longEntry,
        shortEntry: shortEma,
        longSecondary,
        shortSecondary,
        size: { kind: best.sizeKind, value: best.sizeValue },
        tp: best.tp,
        sl: best.sl,
        orderType: "market",
        clips: best.clips,
        dip: best.dip,
        sizeMultiplier: "1.5",
      }),
      first.timeMs,
      last.timeMs,
      {
        stage: "probe",
        label: "mult",
        side: "both",
        sizeKind: best.sizeKind,
        sizeValue: best.sizeValue,
        tp: best.tp,
        sl: best.sl,
        orderType: "market",
        clips: best.clips,
        dip: best.dip,
        extra: "later clips ×1.5",
      },
    ),
  );

  const followUps: Row[] = [];
  const challenger = bestOf([...probes, ...signals], (row) => !row.liquidated);
  if (challenger && challenger.realized > best.realized) {
    for (const size of SIZES) {
      if (size.kind === challenger.sizeKind && size.value === challenger.sizeValue) {
        continue;
      }
      const spec = challenger.stage === "signal" ? signalSpec(challenger.label) : null;
      const recipe = spec
          ? sideRecipe(
              spec.entry,
              spec.exit,
              spec.secondary,
              spec.side,
              size,
              challenger.clips,
              challenger.dip,
            )
          : bothRecipe({
              longEntry,
              shortEntry: shortEma,
              longSecondary,
              shortSecondary,
              size,
              tp: challenger.tp,
              sl: challenger.sl,
              orderType: challenger.orderType,
              clips: challenger.clips,
              dip: challenger.dip,
              breakeven: challenger.extra.includes("breakeven"),
              sizeMultiplier: challenger.extra.includes("×1.5") ? "1.5" : undefined,
            });
      followUps.push(
        await replay(bars, recipe, first.timeMs, last.timeMs, {
          stage: "follow",
          label: `${challenger.label} ${size.kind}${size.value}`,
          side: challenger.side,
          sizeKind: size.kind,
          sizeValue: size.value,
          tp: challenger.tp,
          sl: challenger.sl,
          orderType: challenger.orderType,
          clips: challenger.clips,
          dip: challenger.dip,
          extra: challenger.extra,
        }),
      );
    }
  }

  const pool = [...rows, ...sides, ...signals, ...probes, ...followUps];
  const winner = bestOf(pool, (row) => !row.liquidated) ?? best;
  const calm = bestOf(
    pool,
    (row) => !row.liquidated && row.drawdown <= DEFAULT_STARTING_USDT * 0.25,
  );
  const busy = bestOf(pool, (row) => !row.liquidated && row.trades >= 100);
  const sizeBest =
    bestOf(
      rows.filter(
        (row) =>
          row.side === "both" &&
          row.tp === "2" &&
          row.sl === "5" &&
          row.clips === 4 &&
          row.dip === 1 &&
          row.orderType === "market" &&
          row.extra === "",
      ),
      (row) => !row.liquidated,
    ) ?? baseline;
  const top = [...pool]
    .filter((row) => !row.liquidated)
    .sort((a, b) => b.realized - a.realized)
    .slice(0, 12);
  const liquidated = [...pool]
    .filter((row) => row.liquidated)
    .sort((a, b) => b.sizeValue - a.sizeValue)
    .slice(0, 8);

  const markdown = render({
    bars: bars.length,
    from: new Date(first.timeMs).toISOString().slice(0, 10),
    to: new Date(last.timeMs).toISOString().slice(0, 10),
    baseline,
    best: winner,
    calm,
    busy,
    sizeBest,
    top,
    liquidated,
    sides,
    signals,
    probes: [...probes, ...followUps],
  });
  writeFileSync(RESULTS_PATH, markdown);
  writeFileSync("/tmp/eth-account-max.json", JSON.stringify({ winner, calm, busy, top }, null, 2));
  console.log(`Wrote ${RESULTS_PATH}`);
  console.log(
    `BEST ${usd(winner.realized)} APY ${pct(winner.apy)} ${describe(winner)}`,
  );
}

function sideExit(tp: string, sl: string, orderType: "market" | "limit"): ExitSpec {
  return {
    id: "acct",
    name: `TP ${tp}%`,
    tpKind: "percent",
    tpPct: tp,
    tpAtr: null,
    tpOrder: orderType,
    slPct: sl,
    trail: false,
  };
}

function signalSpec(label: string): {
  entry: EntrySpec;
  exit: ExitSpec;
  secondary: SecondarySpec;
  side: "long" | "short";
  label: string;
} {
  const spec = signalCatalog().find((item) => item.label === label);
  if (!spec) {
    throw new Error(`Missing signal ${label}`);
  }
  return spec;
}

function signalCatalog(): Array<{
  entry: EntrySpec;
  exit: ExitSpec;
  secondary: SecondarySpec;
  side: "long" | "short";
  label: string;
}> {
  return [
    {
      entry: findById(ENTRIES, "smax-a"),
      exit: findById(EXITS, "tp-atr"),
      secondary: findById(SECONDARIES, "ema-below"),
      side: "long",
      label: "SMA cross ATR",
    },
    {
      entry: findById(ENTRIES, "ema-xa"),
      exit: findById(EXITS, "tp-atr"),
      secondary: findById(SECONDARIES, "sma-below"),
      side: "long",
      label: "EMA cross ATR",
    },
    {
      entry: shortEma,
      exit: findById(EXITS, "tp-pct-lmt"),
      secondary: findById(SECONDARIES, "bb-inside"),
      side: "short",
      label: "EMA cross limit",
    },
    {
      entry: shortSupertrend,
      exit: findById(EXITS, "tp-atr"),
      secondary: findById(SECONDARIES, "ema-above"),
      side: "short",
      label: "Supertrend ATR",
    },
  ];
}

async function signalProbes(
  bars: CandleBar[],
  fromMs: number,
  toMs: number,
  size: SizeSpec,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (const probe of signalCatalog()) {
    rows.push(
      await replay(
        bars,
        sideRecipe(probe.entry, probe.exit, probe.secondary, probe.side, size, 4, 1),
        fromMs,
        toMs,
        {
          stage: "signal",
          label: probe.label,
          side: probe.side,
          sizeKind: size.kind,
          sizeValue: size.value,
          tp: probe.exit.tpKind === "atr" ? `ATR ×${probe.exit.tpAtr}` : (probe.exit.tpPct ?? ""),
          sl: probe.exit.slPct,
          orderType: probe.exit.tpOrder,
          clips: 4,
          dip: 1,
          extra: probe.label,
        },
      ),
    );
  }
  return rows;
}

const entry = process.argv[1]?.replaceAll("\\", "/") ?? "";
if (entry.endsWith("eth-dca-account-max.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
