/**
 * Same DCA entry × exit grid as eth-dca-sweep.ts, on 10 years of ETH.
 *
 * Coinbase ETH-USD 6h is the tape. Bybit and Hyperliquid do not keep
 * a 10-year 4h history that this environment can read. 6h is the
 * nearest bot timeframe (360 minutes).
 *
 * Run: npx tsx lib/backtest/eth-dca-sweep-10y.ts
 */
import { writeFileSync } from "node:fs";

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

const RESULTS_PATH = "docs/dca-eth-sweep-10y.md";
const TIMEFRAME = "360";
const VENUE = "bybit" as const;
const SYMBOL = "ETHUSDT";
const FROM_MS = Date.parse("2016-10-01T00:00:00Z");
const TO_MS = Date.parse("2026-10-01T00:00:00Z");
const HALF_BOOK = DEFAULT_STARTING_USDT / 2;

const SHORT_ENTRIES: EntrySpec[] = [
  {
    id: "rsi-xa",
    name: "RSI crosses above 70",
    startKind: "indicator",
    kind: "rsi",
    compare: "cross_gte",
    level: "70",
    period: "14",
  },
  {
    id: "macd-xb",
    name: "MACD crosses below 0",
    startKind: "indicator",
    kind: "macd",
    compare: "cross_lte",
    level: "0",
  },
  {
    id: "ema-xb",
    name: "Price crosses below EMA 21",
    startKind: "indicator",
    kind: "ema",
    compare: "cross_lte",
    period: "21",
  },
  {
    id: "sma-xb",
    name: "Price crosses below SMA 21",
    startKind: "indicator",
    kind: "sma",
    compare: "cross_lte",
    period: "21",
  },
  {
    id: "emax-b",
    name: "EMA 9 crosses below EMA 21",
    startKind: "indicator",
    kind: "ema_cross",
    compare: "cross_lte",
    period: "9",
    slow: "21",
  },
  {
    id: "smax-b",
    name: "SMA 9 crosses below SMA 21",
    startKind: "indicator",
    kind: "sma_cross",
    compare: "cross_lte",
    period: "9",
    slow: "21",
  },
  {
    id: "bb-xt",
    name: "Price crosses above BB upper",
    startKind: "indicator",
    kind: "bb",
    compare: "cross_gte",
    period: "20",
  },
  {
    id: "st-tr",
    name: "Supertrend turns bearish",
    startKind: "trend",
    kind: "supertrend",
    compare: "cross_lte",
    period: "10",
    mult: "3",
  },
];

type SideName = "long" | "short";

type CellResult = {
  side: SideName;
  entry: EntrySpec;
  exit: ExitSpec;
  secondary: SecondarySpec | null;
  net: number;
  grossWin: number;
  grossLoss: number;
  trades: number;
  wins: number;
  maxDrawdownUsdt: number;
  liquidated: boolean;
  endingUsdt: number;
};

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

function better(left: CellResult, right: CellResult): CellResult {
  if (left.liquidated !== right.liquidated) {
    return left.liquidated ? right : left;
  }
  if (right.net !== left.net) {
    return right.net > left.net ? right : left;
  }
  return right.trades > left.trades ? right : left;
}

function score(
  side: SideName,
  entry: EntrySpec,
  exit: ExitSpec,
  secondary: SecondarySpec | null,
  orders: SimulatedOrder[],
  stats: BacktestStats,
): CellResult {
  let grossWin = 0;
  let grossLoss = 0;
  let liquidated = false;
  for (const order of orders) {
    if (order.reason === "liquidation") {
      liquidated = true;
    }
    if (order.action !== "flatten" || order.realizedUsdt == null) {
      continue;
    }
    if (order.realizedUsdt > 0) {
      grossWin += order.realizedUsdt;
    } else if (order.realizedUsdt < 0) {
      grossLoss += Math.abs(order.realizedUsdt);
    }
  }
  return {
    side,
    entry,
    exit,
    secondary,
    net: stats.realizedUsdt,
    grossWin,
    grossLoss,
    trades: stats.trades,
    wins: stats.wins,
    maxDrawdownUsdt: stats.maxDrawdownUsdt,
    liquidated: liquidated || stats.endingUsdt <= 0,
    endingUsdt: stats.endingUsdt,
  };
}

async function loadCoinbase6h(): Promise<CandleBar[]> {
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
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url);
      if (response.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      body = await response.json();
      if (!response.ok || !Array.isArray(body)) {
        throw new Error(
          `Coinbase ${response.status} ${JSON.stringify(body).slice(0, 180)}`,
        );
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
  return [...byTime.values()].sort((a, b) => a.timeMs - b.timeMs);
}

function fixedRecipe(
  entry: EntrySpec,
  exit: ExitSpec,
  secondary: SecondarySpec | null,
  side: SideName,
): DcaTemplateRecipe {
  const tag = side === "long" ? "L" : "S";
  const extra = secondary ? ` · ${secondary.id}` : "";
  return buildRecipe(entry, exit, secondary, {
    timeframe: TIMEFRAME,
    venue: VENUE,
    symbol: SYMBOL,
    direction: side,
    name: `10y ${tag} ${entry.id} · ${exit.id}${extra}`,
  });
}

async function replayRecipe(
  bars: CandleBar[],
  recipe: DcaTemplateRecipe,
  startingUsdt: number,
): Promise<{ orders: SimulatedOrder[]; stats: BacktestStats }> {
  return replayDcaPlaybook({
    bars,
    recipe,
    feeRate: BACKTEST_FEE_PRESETS.vip0_taker.rate,
    startingUsdt,
    leverage: DEFAULT_LEVERAGE,
    venue: VENUE,
  });
}

async function sweepSide(
  bars: CandleBar[],
  side: SideName,
  entries: EntrySpec[],
): Promise<CellResult[]> {
  const rows: CellResult[] = [];
  for (const entry of entries) {
    for (const exit of EXITS) {
      let best = null as CellResult | null;
      for (const secondary of [null, ...SECONDARIES]) {
        const recipe = fixedRecipe(entry, exit, secondary, side);
        const result = await replayRecipe(bars, recipe, DEFAULT_STARTING_USDT);
        const cell = score(side, entry, exit, secondary, result.orders, result.stats);
        rows.push(cell);
        best = best ? better(best, cell) : cell;
      }
      console.log(
        `${side} ${entry.id} ${exit.id} best ${best?.secondary?.id ?? "off"} ${best?.net.toFixed(2)}`,
      );
    }
  }
  return rows;
}

function setIndicator(
  form: FormData,
  side: SideName,
  entry: EntrySpec,
): void {
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
  secondary: SecondarySpec | null,
): void {
  if (!secondary) {
    return;
  }
  form.set(`${prefix}Kind`, secondary.kind);
  form.set(`${prefix}Timeframe`, TIMEFRAME);
  form.set(`${prefix}Compare`, secondary.compare);
  if (secondary.period) {
    form.set(`${prefix}Period`, secondary.period);
  }
  if (secondary.level != null) {
    form.set(`${prefix}Level`, secondary.level);
  }
  if (secondary.levelTo != null) {
    form.set(`${prefix}LevelTo`, secondary.levelTo);
  }
  if (secondary.mult != null) {
    form.set(`${prefix}Multiplier`, secondary.mult);
  }
}

function setExit(form: FormData, exit: ExitSpec): void {
  form.set("takeProfitKind", exit.tpKind);
  if (exit.tpPct != null) {
    form.set("takeProfitPct", exit.tpPct);
  }
  if (exit.tpAtr != null) {
    form.set("takeProfitAtrMult", exit.tpAtr);
    form.set("atrPeriod", "14");
  }
  form.set("takeProfitBasis", "average");
  form.set("takeProfitOrderType", exit.tpOrder);
  form.set("stopLossPct", exit.slPct);
  form.set("stopLossBasis", "average");
  form.set("stopLossOrderType", "market");
  if (exit.trail) {
    form.set("trailingTriggerPct", "1");
    form.set("trailingPct", "0.5");
  }
}

function compoundRecipe(
  entry: EntrySpec,
  exit: ExitSpec,
  secondary: SecondarySpec | null,
  side: SideName,
  bookUsdt: number,
  name: string,
): DcaTemplateRecipe {
  return buildRecipe(entry, exit, secondary, {
    timeframe: TIMEFRAME,
    venue: VENUE,
    symbol: SYMBOL,
    direction: side,
    compound: true,
    bookUsdt,
    name,
  });
}

function bothRecipe(
  long: CellResult,
  short: CellResult,
  exit: ExitSpec,
  name: string,
): DcaTemplateRecipe {
  const form = new FormData();
  form.set("name", name);
  form.set("deskVenue", VENUE);
  form.set("symbol", SYMBOL);
  form.set("direction", "both");
  form.set("startKind", long.entry.startKind);
  setIndicator(form, "long", long.entry);
  setIndicator(form, "short", short.entry);
  setSecondary(form, "confirm", long.secondary);
  setSecondary(form, "shortConfirm", short.secondary);
  form.set("clipSize", "100");
  form.set("sizeUnit", "usdt");
  form.set("averaging", "dip");
  form.set("restGrid", "1");
  form.set("dipPct", "1");
  form.set("maxClips", "4");
  form.set("maxValueKind", "percent");
  form.set("maxValue", "4");
  form.set("accountBookUsdt", String(DEFAULT_STARTING_USDT));
  form.set("accountLeverage", String(DEFAULT_LEVERAGE));
  form.set("spacingKind", "percent");
  form.set("sizeMultiplier", "1");
  form.set("deviationMultiplier", "1");
  setExit(form, exit);
  const parsed = parseDcaPlaybookForm(form, VENUE);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return snapshotDcaRecipe(parsed.config);
}

function rankTable(rows: CellResult[]): string {
  const lines = [
    "| # | Side | Entry | Exit | Secondary | Net | Gross win | Gross loss | Trades |",
    "| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: |",
  ];
  rows.forEach((row, index) => {
    lines.push(
      `| ${index + 1} | ${row.side} | ${row.entry.name} | ${row.exit.name} | ${row.secondary?.name ?? "Off"} | ${usd(row.net)} | ${usd(row.grossWin)} | ${dollars(row.grossLoss)} | ${row.trades} |`,
    );
  });
  return lines.join("\n");
}

function describeCell(row: CellResult): string {
  const secondary = row.secondary ? `, secondary ${row.secondary.name}` : ", secondary off";
  return `${row.entry.name}, ${row.exit.name}${secondary}`;
}

async function main(): Promise<void> {
  console.log("Loading Coinbase ETH-USD 6h…");
  const bars = await loadCoinbase6h();
  const first = bars[0];
  const last = bars[bars.length - 1];
  if (!first || !last || bars.length < 1000) {
    throw new Error(`Tape too short: ${bars.length} bars.`);
  }
  console.log(
    `Tape ${bars.length} bars ${new Date(first.timeMs).toISOString()} → ${new Date(last.timeMs).toISOString()}`,
  );

  const longRows = await sweepSide(bars, "long", ENTRIES);
  const shortRows = await sweepSide(bars, "short", SHORT_ENTRIES);
  const longBestByCell = bestOfEachCell(longRows);
  const shortBestByCell = bestOfEachCell(shortRows);
  const bestLong = [...longBestByCell].sort((a, b) => b.net - a.net)[0];
  const bestShort = [...shortBestByCell].sort((a, b) => b.net - a.net)[0];
  if (!bestLong || !bestShort) {
    throw new Error("Missing a side winner.");
  }

  const longCompound = await replayRecipe(
    bars,
    compoundRecipe(
      bestLong.entry,
      bestLong.exit,
      bestLong.secondary,
      "long",
      DEFAULT_STARTING_USDT,
      "10y L compound",
    ),
    DEFAULT_STARTING_USDT,
  );
  const shortCompound = await replayRecipe(
    bars,
    compoundRecipe(
      bestShort.entry,
      bestShort.exit,
      bestShort.secondary,
      "short",
      DEFAULT_STARTING_USDT,
      "10y S compound",
    ),
    DEFAULT_STARTING_USDT,
  );
  const longHalf = await replayRecipe(
    bars,
    compoundRecipe(
      bestLong.entry,
      bestLong.exit,
      bestLong.secondary,
      "long",
      HALF_BOOK,
      "10y L half",
    ),
    HALF_BOOK,
  );
  const shortHalf = await replayRecipe(
    bars,
    compoundRecipe(
      bestShort.entry,
      bestShort.exit,
      bestShort.secondary,
      "short",
      HALF_BOOK,
      "10y S half",
    ),
    HALF_BOOK,
  );

  let shared: { exitName: string; stats: BacktestStats } | null = null;
  let sharedNote = "";
  if (bestLong.entry.startKind !== bestShort.entry.startKind) {
    sharedNote =
      "The winning long start and the winning short start are different start kinds, so one DCA bot cannot run both. The overall figure is the two half-books.";
  } else {
    const exits = [bestLong.exit, bestShort.exit].filter(
      (exit, index, all) => all.findIndex((item) => item.id === exit.id) === index,
    );
    let bestShared: { exitName: string; stats: BacktestStats } | null = null;
    for (const exit of exits) {
      const recipe = bothRecipe(bestLong, bestShort, exit, `10y both ${exit.id}`);
      const result = await replayRecipe(bars, recipe, DEFAULT_STARTING_USDT);
      console.log(`both ${exit.id} net ${result.stats.realizedUsdt.toFixed(2)}`);
      if (
        !bestShared ||
        result.stats.realizedUsdt > bestShared.stats.realizedUsdt
      ) {
        bestShared = { exitName: exit.name, stats: result.stats };
      }
    }
    shared = bestShared;
    sharedNote =
      "One bot, direction both, one cash book. Each side keeps its winning start and secondary. The exit is the shared exit with the higher realized profit.";
  }

  const portfolioRealized =
    longHalf.stats.realizedUsdt + shortHalf.stats.realizedUsdt;
  const portfolioEnding =
    longHalf.stats.endingUsdt + shortHalf.stats.endingUsdt;
  const portfolioApy = backtestAprPct(
    portfolioRealized,
    DEFAULT_STARTING_USDT,
    first.timeMs,
    last.timeMs,
  );

  const markdown = render({
    bars: bars.length,
    firstMs: first.timeMs,
    lastMs: last.timeMs,
    longFixed: [...longBestByCell].sort((a, b) => b.net - a.net),
    shortFixed: [...shortBestByCell].sort((a, b) => b.net - a.net),
    bestLong,
    bestShort,
    longCompound: longCompound.stats,
    shortCompound: shortCompound.stats,
    longHalf: longHalf.stats,
    shortHalf: shortHalf.stats,
    portfolioRealized,
    portfolioEnding,
    portfolioApy,
    shared,
    sharedNote,
  });
  writeFileSync(RESULTS_PATH, markdown);
  console.log(`Wrote ${RESULTS_PATH}`);
  console.log(
    `Portfolio realized ${portfolioRealized.toFixed(2)} APY ${portfolioApy}`,
  );
}

function bestOfEachCell(rows: CellResult[]): CellResult[] {
  const groups = new Map<string, CellResult>();
  for (const row of rows) {
    const key = `${row.entry.id}__${row.exit.id}`;
    const current = groups.get(key);
    groups.set(key, current ? better(current, row) : row);
  }
  return [...groups.values()];
}

function render(input: {
  bars: number;
  firstMs: number;
  lastMs: number;
  longFixed: CellResult[];
  shortFixed: CellResult[];
  bestLong: CellResult;
  bestShort: CellResult;
  longCompound: BacktestStats;
  shortCompound: BacktestStats;
  longHalf: BacktestStats;
  shortHalf: BacktestStats;
  portfolioRealized: number;
  portfolioEnding: number;
  portfolioApy: number | null;
  shared: { exitName: string; stats: BacktestStats } | null;
  sharedNote: string;
}): string {
  const from = new Date(input.firstMs).toISOString().slice(0, 10);
  const to = new Date(input.lastMs).toISOString().slice(0, 10);
  const longApy = backtestAprPct(
    input.longCompound.realizedUsdt,
    DEFAULT_STARTING_USDT,
    input.firstMs,
    input.lastMs,
  );
  const shortApy = backtestAprPct(
    input.shortCompound.realizedUsdt,
    DEFAULT_STARTING_USDT,
    input.firstMs,
    input.lastMs,
  );
  const lines: string[] = [];
  lines.push("# ETH DCA sweep, 10 years");
  lines.push("");
  lines.push(
    `Same eight long starts and five exits as the one-year study, plus the short mirror of each start. Tape is Coinbase ETH-USD 6h, ${from} to ${to} (${input.bars} bars). Bybit’s public candles are blocked here, and Hyperliquid does not keep ten years of 4h. 6h is the bot timeframe \`360\`. Fixed-clip pass: $10,000, 10×, $100 clips, four adds at a 1% dip, 6 bps. Each cell also ran all 15 secondary conditions. The winner is the secondary with the highest net.`,
  );
  lines.push("");
  lines.push("## Best long, fixed clip");
  lines.push("");
  lines.push(rankTable(input.longFixed.slice(0, 8)));
  lines.push("");
  lines.push("## Best short, fixed clip");
  lines.push("");
  lines.push(rankTable(input.shortFixed.slice(0, 8)));
  lines.push("");
  lines.push("## Winners taken into the compound test");
  lines.push("");
  lines.push(`- Long: ${describeCell(input.bestLong)}. Fixed-clip net ${usd(input.bestLong.net)} over ${input.bestLong.trades} trades.`);
  lines.push(`- Short: ${describeCell(input.bestShort)}. Fixed-clip net ${usd(input.bestShort.net)} over ${input.bestShort.trades} trades.`);
  lines.push("");
  lines.push("## Each winner compounding on its own $10,000");
  lines.push("");
  lines.push(
    "Compounding uses 4% of the cash book (start plus realized) for the four-clip ladder. That is a $100 first clip on $10,000, and the clip grows or shrinks with closed profit. Open profit is not resized until the cycle ends.",
  );
  lines.push("");
  lines.push("| Book | Realized | Ending equity | APY | Trades | Liquidated |");
  lines.push("| --- | ---: | ---: | ---: | ---: | --- |");
  lines.push(
    `| Long $10,000 | ${usd(input.longCompound.realizedUsdt)} | ${dollars(input.longCompound.endingUsdt)} | ${pct(longApy)} | ${input.longCompound.trades} | ${input.longCompound.endingUsdt <= 0 ? "yes" : "no"} |`,
  );
  lines.push(
    `| Short $10,000 | ${usd(input.shortCompound.realizedUsdt)} | ${dollars(input.shortCompound.endingUsdt)} | ${pct(shortApy)} | ${input.shortCompound.trades} | ${input.shortCompound.endingUsdt <= 0 ? "yes" : "no"} |`,
  );
  lines.push("");
  lines.push("## Both strategies together");
  lines.push("");
  if (input.shared) {
    const sharedApy = backtestAprPct(
      input.shared.stats.realizedUsdt,
      DEFAULT_STARTING_USDT,
      input.firstMs,
      input.lastMs,
    );
    const longFilter = input.bestLong.secondary
      ? ` with ${input.bestLong.secondary.name}`
      : "";
    const shortFilter = input.bestShort.secondary
      ? ` with ${input.bestShort.secondary.name}`
      : "";
    lines.push(
      `One bot, direction both, one $10,000 cash book. The long side is ${input.bestLong.entry.name}${longFilter}. The short side is ${input.bestShort.entry.name}${shortFilter}. Both sides use the shared exit ${input.shared.exitName} and its ${input.bestLong.exit.slPct}% stop. Each new cycle sizes the four-clip ladder at 4% of that book, so closed profit changes the next clip.`,
    );
    lines.push("");
    lines.push(
      `**Overall realized profit ${usd(input.shared.stats.realizedUsdt)}. Ending equity ${dollars(input.shared.stats.endingUsdt)}. APY ${pct(sharedApy)}.** ${input.shared.stats.trades.toLocaleString("en-US")} closed trades. ${input.shared.stats.endingUsdt <= 0 ? "Liquidated." : "Not liquidated."}`,
    );
    lines.push("");
    lines.push(
      `APY is (1 + realized / 10,000) ^ (365.25 / days) − 1 over ${from} to ${to}.`,
    );
    lines.push("");
  } else {
    lines.push(input.sharedNote);
    lines.push("");
  }
  lines.push(
    `Running the same two bots as separate half-books ($${HALF_BOOK.toFixed(0)} each, still one $10,000 start) realized ${usd(input.portfolioRealized)}, ending equity ${dollars(input.portfolioEnding)}, APY ${pct(input.portfolioApy)}. Splitting the cash in half cuts the clip in half, so the dollar profit is about half. ${input.shared ? "The shared bot is the combined test." : "The half-books are the combined test."}`,
  );
  lines.push("");
  lines.push(
    "Paper fills on this Coinbase tape only. The one-year Hyperliquid runs stay on the admin account. These 10-year fills are not saved there, because that chart would reload Hyperliquid or Bybit candles and would not match this tape.",
  );
  lines.push("");
  return lines.join("\n");
}

const sweepEntry = process.argv[1]?.replaceAll("\\", "/") ?? "";
if (sweepEntry.endsWith("eth-dca-sweep-10y.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
