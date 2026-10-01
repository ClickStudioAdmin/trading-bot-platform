/**
 * ETH DCA entry × exit sweep. Plan: docs/dca-eth-sweep.md
 *
 * Paper replay only. Saves finished runs on the admin login.
 * Run: npx tsx lib/backtest/eth-dca-sweep.ts
 */
import { writeFileSync } from "node:fs";

import type { DcaFilterCompare, DcaFilterKind } from "@/lib/dca/filters";
import {
  parseDcaPlaybookForm,
  type DcaIndicatorKind,
  type DcaStartKind,
} from "@/lib/dca/playbook";
import { snapshotDcaRecipe, type DcaTemplateRecipe } from "@/lib/templates/recipe";
import { loadBacktestCandles } from "@/lib/market/desk-klines";
import type { CandleBar } from "@/lib/market/candles";
import {
  BACKTEST_FEE_PRESETS,
  DEFAULT_LEVERAGE,
  DEFAULT_STARTING_USDT,
  backtestTapeInterval,
  backtestWindowEndingToday,
  parseBacktestDates,
  type BacktestStats,
  type SimulatedOrder,
} from "@/lib/backtest/model";
import { replayDcaPlaybook } from "@/lib/backtest/replay-dca";
import { createServiceClient } from "@/lib/supabase/admin";

const ADMIN_EMAIL = "click.studio.admin@gmail.com";
const TIMEFRAME = "240";
const RESULTS_PATH = "docs/dca-eth-sweep-results.md";

export type EntrySpec = {
  id: string;
  name: string;
  startKind: DcaStartKind;
  kind: DcaIndicatorKind;
  compare: string;
  level?: string;
  period?: string;
  slow?: string;
  mult?: string;
};

export type ExitSpec = {
  id: string;
  name: string;
  tpKind: "percent" | "atr";
  tpPct: string | null;
  tpAtr: string | null;
  tpOrder: "market" | "limit";
  slPct: string;
  trail: boolean;
};

export type SecondarySpec = {
  id: string;
  name: string;
  kind: DcaFilterKind;
  compare: DcaFilterCompare;
  period?: string;
  level?: string;
  levelTo?: string;
  mult?: string;
};

type Row = {
  entryId: string;
  exitId: string;
  entryName: string;
  exitName: string;
  secondaryId: string;
  secondaryName: string;
  net: number;
  grossWin: number;
  grossLoss: number;
  trades: number;
  wins: number;
  maxDrawdownUsdt: number;
  liquidated: boolean;
  winRate: number;
};

export const ENTRIES: EntrySpec[] = [
  {
    id: "rsi-xb",
    name: "RSI crosses below 30",
    startKind: "indicator",
    kind: "rsi",
    compare: "cross_lte",
    level: "30",
    period: "14",
  },
  {
    id: "macd-xa",
    name: "MACD crosses above 0",
    startKind: "indicator",
    kind: "macd",
    compare: "cross_gte",
    level: "0",
  },
  {
    id: "ema-xa",
    name: "Price crosses above EMA 21",
    startKind: "indicator",
    kind: "ema",
    compare: "cross_gte",
    period: "21",
  },
  {
    id: "sma-xa",
    name: "Price crosses above SMA 21",
    startKind: "indicator",
    kind: "sma",
    compare: "cross_gte",
    period: "21",
  },
  {
    id: "emax-a",
    name: "EMA 9 crosses above EMA 21",
    startKind: "indicator",
    kind: "ema_cross",
    compare: "cross_gte",
    period: "9",
    slow: "21",
  },
  {
    id: "smax-a",
    name: "SMA 9 crosses above SMA 21",
    startKind: "indicator",
    kind: "sma_cross",
    compare: "cross_gte",
    period: "9",
    slow: "21",
  },
  {
    id: "bb-xb",
    name: "Price crosses below BB lower",
    startKind: "indicator",
    kind: "bb",
    compare: "cross_lte",
    period: "20",
  },
  {
    id: "st-tb",
    name: "Supertrend turns bullish",
    startKind: "trend",
    kind: "supertrend",
    compare: "cross_gte",
    period: "10",
    mult: "3",
  },
];

export const EXITS: ExitSpec[] = [
  {
    id: "tp-pct-mkt",
    name: "TP 2% market",
    tpKind: "percent",
    tpPct: "2",
    tpAtr: null,
    tpOrder: "market",
    slPct: "5",
    trail: false,
  },
  {
    id: "tp-pct-lmt",
    name: "TP 2% limit",
    tpKind: "percent",
    tpPct: "2",
    tpAtr: null,
    tpOrder: "limit",
    slPct: "5",
    trail: false,
  },
  {
    id: "tp-atr",
    name: "TP ATR ×2",
    tpKind: "atr",
    tpPct: null,
    tpAtr: "2",
    tpOrder: "market",
    slPct: "5",
    trail: false,
  },
  {
    id: "sl-tight",
    name: "Tight stop 0.5%",
    tpKind: "percent",
    tpPct: "20",
    tpAtr: null,
    tpOrder: "market",
    slPct: "0.5",
    trail: false,
  },
  {
    id: "trail",
    name: "Trailing 1% / 0.5%",
    tpKind: "percent",
    tpPct: "20",
    tpAtr: null,
    tpOrder: "market",
    slPct: "20",
    trail: true,
  },
];

export const SECONDARIES: SecondarySpec[] = [
  {
    id: "ema-above",
    name: "EMA above",
    kind: "ema",
    compare: "gte",
    period: "21",
  },
  {
    id: "ema-below",
    name: "EMA below",
    kind: "ema",
    compare: "lte",
    period: "21",
  },
  {
    id: "sma-above",
    name: "SMA above",
    kind: "sma",
    compare: "gte",
    period: "21",
  },
  {
    id: "sma-below",
    name: "SMA below",
    kind: "sma",
    compare: "lte",
    period: "21",
  },
  {
    id: "rsi-below",
    name: "RSI at or below 30",
    kind: "rsi",
    compare: "lte",
    period: "14",
    level: "30",
  },
  {
    id: "rsi-above",
    name: "RSI at or above 70",
    kind: "rsi",
    compare: "gte",
    period: "14",
    level: "70",
  },
  {
    id: "rsi-between",
    name: "RSI between 30 and 70",
    kind: "rsi",
    compare: "between",
    period: "14",
    level: "30",
    levelTo: "70",
  },
  {
    id: "bb-above",
    name: "BB above",
    kind: "bb",
    compare: "gte",
    period: "20",
  },
  {
    id: "bb-below",
    name: "BB below",
    kind: "bb",
    compare: "lte",
    period: "20",
  },
  {
    id: "bb-inside",
    name: "BB inside",
    kind: "bb",
    compare: "inside",
    period: "20",
  },
  {
    id: "atr-above",
    name: "ATR band above",
    kind: "atr_band",
    compare: "gte",
    period: "10",
    mult: "2",
  },
  {
    id: "atr-below",
    name: "ATR band below",
    kind: "atr_band",
    compare: "lte",
    period: "10",
    mult: "2",
  },
  {
    id: "atr-inside",
    name: "ATR band inside",
    kind: "atr_band",
    compare: "inside",
    period: "10",
    mult: "2",
  },
  {
    id: "st-bull",
    name: "Supertrend bullish",
    kind: "supertrend",
    compare: "gte",
    period: "10",
    mult: "3",
  },
  {
    id: "st-bear",
    name: "Supertrend bearish",
    kind: "supertrend",
    compare: "lte",
    period: "10",
    mult: "3",
  },
];

function recipeName(
  entry: EntrySpec,
  exit: ExitSpec,
  secondary: SecondarySpec | null,
): string {
  const extra = secondary ? ` · ${secondary.id}` : "";
  const name = `ETH ${entry.id} · ${exit.id}${extra}`;
  if (name.length > 40) {
    throw new Error(`Name is ${name.length} characters: ${name}`);
  }
  return name;
}

export type SweepRecipeOptions = {
  timeframe?: string;
  venue?: "bybit" | "hyperliquid";
  symbol?: string;
  direction?: "long" | "short";
  compound?: boolean;
  bookUsdt?: number;
  name?: string;
};

export function buildRecipe(
  entry: EntrySpec,
  exit: ExitSpec,
  secondary: SecondarySpec | null,
  options: SweepRecipeOptions = {},
): DcaTemplateRecipe {
  const timeframe = options.timeframe ?? TIMEFRAME;
  const venue = options.venue ?? "hyperliquid";
  const symbol = options.symbol ?? (venue === "hyperliquid" ? "ETH" : "ETHUSDT");
  const form = new FormData();
  form.set("name", options.name ?? recipeName(entry, exit, secondary));
  form.set("deskVenue", venue);
  form.set("symbol", symbol);
  form.set("direction", options.direction ?? "long");
  form.set("startKind", entry.startKind);
  form.set("indicatorKind", entry.kind);
  form.set("indicatorTimeframe", timeframe);
  form.set("indicatorCompare", entry.compare);
  if (entry.level != null) {
    form.set("indicatorLevel", entry.level);
  }
  if (entry.period != null) {
    form.set("indicatorPeriod", entry.period);
  }
  if (entry.slow != null) {
    form.set("indicatorSlowPeriod", entry.slow);
  }
  if (entry.mult != null) {
    form.set("indicatorMultiplier", entry.mult);
  }
  form.set("clipSize", "100");
  form.set("sizeUnit", "usdt");
  form.set("averaging", "dip");
  form.set("restGrid", "1");
  form.set("dipPct", "1");
  form.set("maxClips", "4");
  if (options.compound) {
    form.set("maxValueKind", "percent");
    form.set("maxValue", "4");
    form.set("accountBookUsdt", String(options.bookUsdt ?? DEFAULT_STARTING_USDT));
    form.set("accountLeverage", String(DEFAULT_LEVERAGE));
  } else {
    form.set("maxType", "orders");
  }
  form.set("spacingKind", "percent");
  form.set("sizeMultiplier", "1");
  form.set("deviationMultiplier", "1");
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
  if (secondary) {
    form.set("confirmKind", secondary.kind);
    form.set("confirmTimeframe", timeframe);
    form.set("confirmCompare", secondary.compare);
    if (secondary.period) {
      form.set("confirmPeriod", secondary.period);
    }
    if (secondary.level != null) {
      form.set("confirmLevel", secondary.level);
    }
    if (secondary.levelTo != null) {
      form.set("confirmLevelTo", secondary.levelTo);
    }
    if (secondary.mult != null) {
      form.set("confirmMultiplier", secondary.mult);
    }
  }
  const parsed = parseDcaPlaybookForm(form, venue);
  if (!parsed.ok) {
    throw new Error(
      `${entry.id} ${exit.id} ${secondary?.id ?? "off"}: ${parsed.error}`,
    );
  }
  return snapshotDcaRecipe(parsed.config);
}

function measure(orders: SimulatedOrder[], stats: BacktestStats): {
  grossWin: number;
  grossLoss: number;
  liquidated: boolean;
} {
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
  return { grossWin, grossLoss, liquidated: liquidated || stats.endingUsdt <= 0 };
}

function usd(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function dollars(value: number): string {
  return `$${Math.abs(value).toFixed(2)}`;
}

function betterNet(left: Row, right: Row): Row {
  if (left.liquidated !== right.liquidated) {
    return left.liquidated ? right : left;
  }
  if (right.net !== left.net) {
    return right.net > left.net ? right : left;
  }
  return right.trades > left.trades ? right : left;
}

function withTrades(rows: Row[]): Row[] {
  return rows.filter((row) => row.trades > 0);
}

async function main(): Promise<void> {
  const cells = ENTRIES.length * EXITS.length;
  if (cells !== 40) {
    throw new Error(`Expected 40 cells, got ${cells}.`);
  }
  if (SECONDARIES.length !== 15) {
    throw new Error(`Expected 15 secondaries, got ${SECONDARIES.length}.`);
  }
  for (const entry of ENTRIES) {
    for (const exit of EXITS) {
      buildRecipe(entry, exit, null);
      for (const secondary of SECONDARIES) {
        buildRecipe(entry, exit, secondary);
      }
    }
  }
  console.log(`Parsed ${cells} base recipes and ${cells * SECONDARIES.length} secondaries.`);

  const dates = backtestWindowEndingToday(365);
  const range = parseBacktestDates(dates.from, dates.to);
  if (!range.ok) {
    throw new Error(range.error);
  }
  console.log(`Window ${dates.from} → ${dates.to}. Loading ETH 4h…`);
  const bars: CandleBar[] = await loadBacktestCandles({
    venue: "hyperliquid",
    venueEnvironment: "live",
    symbol: "ETH",
    interval: "240",
    fromMs: range.fromMs,
    toMs: range.toMs,
    limit: 10_000,
  });
  console.log(`Tape ${bars.length} bars.`);
  if (bars.length < 200) {
    throw new Error("ETH tape is too short to rank strategies.");
  }

  const rows: Row[] = [];
  const saves: Array<{
    row: Row;
    recipe: DcaTemplateRecipe;
    orders: SimulatedOrder[];
    stats: BacktestStats;
  }> = [];
  let replayed = 0;
  const started = Date.now();

  for (const entry of ENTRIES) {
    for (const exit of EXITS) {
      const family: Row[] = [];
      const variants: Array<SecondarySpec | null> = [null, ...SECONDARIES];
      let baseSave: (typeof saves)[number] | null = null;
      for (const secondary of variants) {
        const recipe = buildRecipe(entry, exit, secondary);
        const result = await replayDcaPlaybook({
          bars,
          recipe,
          feeRate: BACKTEST_FEE_PRESETS.vip0_taker.rate,
          startingUsdt: DEFAULT_STARTING_USDT,
          leverage: DEFAULT_LEVERAGE,
          venue: "hyperliquid",
        });
        const scored = measure(result.orders, result.stats);
        const row: Row = {
          entryId: entry.id,
          exitId: exit.id,
          entryName: entry.name,
          exitName: exit.name,
          secondaryId: secondary?.id ?? "off",
          secondaryName: secondary?.name ?? "Off",
          net: result.stats.realizedUsdt,
          grossWin: scored.grossWin,
          grossLoss: scored.grossLoss,
          trades: result.stats.trades,
          wins: result.stats.wins,
          maxDrawdownUsdt: result.stats.maxDrawdownUsdt,
          liquidated: scored.liquidated,
          winRate: result.stats.winRate,
        };
        rows.push(row);
        family.push(row);
        replayed += 1;
        if (!secondary) {
          baseSave = { row, recipe, orders: result.orders, stats: result.stats };
        }
      }
      const base = family[0];
      if (!base || !baseSave) {
        throw new Error(`Missing base row for ${entry.id} ${exit.id}.`);
      }
      saves.push(baseSave);
      const bestNet = family.reduce((best, row) => betterNet(best, row));
      if (bestNet.secondaryId !== "off" && bestNet.net > base.net) {
        const secondary = SECONDARIES.find((item) => item.id === bestNet.secondaryId);
        if (!secondary) {
          throw new Error(`Missing secondary ${bestNet.secondaryId}.`);
        }
        const recipe = buildRecipe(entry, exit, secondary);
        const result = await replayDcaPlaybook({
          bars,
          recipe,
          feeRate: BACKTEST_FEE_PRESETS.vip0_taker.rate,
          startingUsdt: DEFAULT_STARTING_USDT,
          leverage: DEFAULT_LEVERAGE,
          venue: "hyperliquid",
        });
        saves.push({
          row: bestNet,
          recipe,
          orders: result.orders,
          stats: result.stats,
        });
      }
      console.log(
        `${entry.id} ${exit.id} net ${base.net.toFixed(2)} best ${bestNet.secondaryId} ${bestNet.net.toFixed(2)} (${replayed})`,
      );
    }
  }

  const elapsedSec = Math.round((Date.now() - started) / 1000);
  const baseRows = rows.filter((row) => row.secondaryId === "off");
  const byNet = [...baseRows].sort((a, b) => b.net - a.net);
  const byGross = [...baseRows].sort((a, b) => b.grossWin - a.grossWin);
  const savedIds = await saveRuns(saves, range.fromMs, range.toMs);
  const markdown = renderMarkdown({
    dates,
    bars: bars.length,
    elapsedSec,
    replayed,
    byNet,
    byGross,
    rows,
    savedIds,
  });
  writeFileSync(RESULTS_PATH, markdown);
  console.log(`Wrote ${RESULTS_PATH}. Saved ${savedIds.size} runs.`);
}

function renderMarkdown(input: {
  dates: { from: string; to: string };
  bars: number;
  elapsedSec: number;
  replayed: number;
  byNet: Row[];
  byGross: Row[];
  rows: Row[];
  savedIds: Map<string, string>;
}): string {
  const lines: string[] = [];
  lines.push("# ETH DCA sweep results");
  lines.push("");
  lines.push(
    `Hyperliquid ETH, 4h, ${input.dates.from} to ${input.dates.to} (${input.bars} bars). Starting balance $10,000, leverage 10×, fee 6 bps. ${input.replayed} replays in ${input.elapsedSec}s. Plan: [dca-eth-sweep.md](dca-eth-sweep.md). Paper fills on that tape only.`,
  );
  lines.push("");
  lines.push("Secondary was off on these rankings. Gross win adds up winning closes and leaves losing closes out.");
  lines.push("");
  lines.push("## Most net profit");
  lines.push("");
  lines.push(rankTable(input.byNet.slice(0, 10)));
  lines.push("");
  lines.push("## Most profit ignoring losses");
  lines.push("");
  lines.push(rankTable(input.byGross.slice(0, 10)));
  lines.push("");
  lines.push("## All 40");
  lines.push("");
  lines.push(rankTable([...input.byNet]));
  lines.push("");
  lines.push("## Each cell, after every secondary");
  lines.push("");
  lines.push(
    "For each of the 40, every Secondary Entry condition was replayed on the same tape. Best net is the highest realized result. Best gross is the highest winning-close total. Lowest loss is the smallest gross loss among variants that closed at least one trade. A variant that never trades is not treated as a lossless strategy.",
  );
  lines.push("");
  lines.push(
    "| Entry | Exit | Base net | Base gross | Base loss | Trades | Best net | Net | Best gross | Gross | Lowest loss | Loss |",
  );
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | --- | ---: | --- | ---: |");
  for (const entry of ENTRIES) {
    for (const exit of EXITS) {
      const family = input.rows.filter(
        (row) => row.entryId === entry.id && row.exitId === exit.id,
      );
      const base = family.find((row) => row.secondaryId === "off");
      if (!base) {
        continue;
      }
      const bestNet = family.reduce((best, row) => betterNet(best, row));
      const traded = withTrades(family);
      const grossPick = traded.reduce(
        (best, row) => (row.grossWin > best.grossWin ? row : best),
        base,
      );
      const lossPick = traded.reduce(
        (best, row) => (row.grossLoss < best.grossLoss ? row : best),
        base,
      );
      lines.push(
        `| ${entry.name} | ${exit.name} | ${usd(base.net)} | ${usd(base.grossWin)} | ${dollars(base.grossLoss)} | ${base.trades} | ${labelPick(bestNet)} | ${usd(bestNet.net)} | ${labelPick(grossPick)} | ${usd(grossPick.grossWin)} | ${labelPick(lossPick)} | ${dollars(lossPick.grossLoss)} |`,
      );
    }
  }
  lines.push("");
  lines.push("## Saved runs");
  lines.push("");
  lines.push(
    "Base runs, plus a secondary variant when it beat that cell’s net, are on the admin account under Saved Backtests. Names look like `ETH rsi-xb · tp-pct-mkt`.",
  );
  lines.push("");
  if (input.savedIds.size === 0) {
    lines.push("No runs were saved.");
  } else {
    lines.push("| Run | Id |");
    lines.push("| --- | --- |");
    for (const [name, id] of input.savedIds) {
      lines.push(`| ${name} | \`${id}\` |`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function labelPick(row: Row): string {
  const flag = row.liquidated ? " (liquidated)" : "";
  return `${row.secondaryName}${flag}`;
}

function rankTable(rows: Row[]): string {
  const lines = [
    "| # | Entry | Exit | Net | Gross win | Gross loss | Trades | Win rate | Max drawdown |",
    "| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  rows.forEach((row, index) => {
    const win = row.trades > 0 ? `${(row.winRate * 100).toFixed(0)}%` : "—";
    const flag = row.liquidated ? " liquidated" : "";
    lines.push(
      `| ${index + 1} | ${row.entryName} | ${row.exitName}${flag} | ${usd(row.net)} | ${usd(row.grossWin)} | ${dollars(row.grossLoss)} | ${row.trades} | ${win} | ${dollars(row.maxDrawdownUsdt)} |`,
    );
  });
  return lines.join("\n");
}

async function saveRuns(
  saves: Array<{
    row: Row;
    recipe: DcaTemplateRecipe;
    orders: SimulatedOrder[];
    stats: BacktestStats;
  }>,
  fromMs: number,
  toMs: number,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const supabase = createServiceClient();
  if (!supabase) {
    console.log("No service client. Results file only.");
    return ids;
  }
  const admin = await supabase
    .from("members")
    .select("user_id")
    .eq("email", ADMIN_EMAIL)
    .maybeSingle();
  const userId = admin.data?.user_id ? String(admin.data.user_id) : "";
  if (!userId) {
    console.log("Admin login was not found. Results file only.");
    return ids;
  }
  const existing = await supabase
    .from("backtest_runs")
    .select("id, recipe")
    .eq("user_id", userId)
    .eq("symbol", "ETH")
    .eq("desk_type", "dca")
    .order("created_at", { ascending: false })
    .limit(400);
  const byName = new Map<string, string>();
  for (const row of existing.data ?? []) {
    const name = String(
      (row.recipe as { name?: string } | null)?.name ?? "",
    );
    if (/^ETH [a-z0-9-]+ · /.test(name) && row.id) {
      byName.set(name, String(row.id));
    }
  }
  for (const save of saves) {
    const name = save.recipe.name;
    const prior = byName.get(name);
    if (prior) {
      ids.set(name, prior);
      continue;
    }
    const interval = backtestTapeInterval(save.recipe, fromMs, toMs);
    const inserted = await supabase
      .from("backtest_runs")
      .insert({
        user_id: userId,
        template_id: null,
        source_template_id: null,
        study_id: null,
        parent_run_id: null,
        comparable_symbols: [],
        desk_type: "dca",
        venue: "hyperliquid",
        venue_environment: "live",
        symbol: "ETH",
        interval,
        from_ms: fromMs,
        to_ms: toMs,
        fee_preset: "vip0_taker",
        fee_rate: BACKTEST_FEE_PRESETS.vip0_taker.rate,
        starting_balance_usdt: DEFAULT_STARTING_USDT,
        leverage: DEFAULT_LEVERAGE,
        status: "done",
        recipe: save.recipe,
        stats: save.stats,
        orders: save.orders,
        error: null,
        finished_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data?.id) {
      console.log(`Save failed for ${name}: ${inserted.error?.message ?? "no id"}`);
      continue;
    }
    const id = String(inserted.data.id);
    byName.set(name, id);
    ids.set(name, id);
  }
  return ids;
}

const sweepEntry = process.argv[1]?.replaceAll("\\", "/") ?? "";
if (sweepEntry.endsWith("eth-dca-sweep.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
