import {
  DCA_INDICATOR_TIMEFRAME_LABELS,
  type DcaIndicatorCompare,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import { emptyFuturesTpsl } from "@/lib/futures/tpsl";
import type { DcaTemplateRecipe, PerpsTemplateRecipe } from "@/lib/templates/recipe";
import {
  intervalMs,
  type BacktestRecipe,
  type BacktestRun,
  type EquityPoint,
} from "./model";

export const STUDY_CANDLE_LIMIT = 1500;

export const STUDY_INTERVALS: DcaIndicatorTimeframe[] = ["15", "60", "240", "D"];
export const STUDY_TP_PCTS = [null, 4, 8, 12] as const;
export const STUDY_SL_PCTS = [null, 5, 10] as const;
export const STUDY_MAX_SCENARIOS = 96;

export type StudyScenario = {
  interval: DcaIndicatorTimeframe;
  recipe: BacktestRecipe;
  label: string;
};

type DcaStartSpec =
  | { kind: "immediate" }
  | { kind: "price"; compare: "gte" | "lte" }
  | {
      kind: "indicator";
      indicatorKind: DcaIndicatorKind;
      compare: DcaIndicatorCompare;
    };

const INDICATOR_KINDS: DcaIndicatorKind[] = ["rsi", "macd", "ema_cross"];
const INDICATOR_COMPARES: DcaIndicatorCompare[] = ["cross_gte", "cross_lte"];

export function studyIntervalsForWindow(
  fromMs: number,
  toMs: number,
): DcaIndicatorTimeframe[] {
  return STUDY_INTERVALS.filter((interval) => {
    const bars = Math.ceil((toMs - fromMs) / intervalMs(interval));
    return bars >= 8 && bars <= STUDY_CANDLE_LIMIT;
  });
}

function pctLabel(value: number | null, prefix: string): string {
  return value == null ? `${prefix} off` : `${prefix} ${value}%`;
}

function startLabel(spec: DcaStartSpec): string {
  if (spec.kind === "immediate") {
    return "Immediate";
  }
  if (spec.kind === "price") {
    return spec.compare === "gte" ? "Price ≥" : "Price ≤";
  }
  const name =
    spec.indicatorKind === "ema_cross"
      ? "EMA cross"
      : spec.indicatorKind.toUpperCase();
  return spec.compare === "cross_lte" ? `${name} cross ≤` : `${name} cross ≥`;
}

function scenarioName(seedName: string, parts: string[]): string {
  return `${seedName.trim() || "Study"} · ${parts.join(" · ")}`.slice(0, 80);
}

function indicatorLevel(
  kind: DcaIndicatorKind,
  compare: DcaIndicatorCompare,
): number | null {
  if (kind === "rsi") {
    return compare === "cross_lte" || compare === "lte" ? 30 : 70;
  }
  if (kind === "macd") {
    return 0;
  }
  return null;
}

function dcaStarts(seed: DcaTemplateRecipe): DcaStartSpec[] {
  const rows: DcaStartSpec[] = [{ kind: "immediate" }];
  if (seed.armTrigger && seed.armTrigger.price > 0) {
    rows.push({ kind: "price", compare: "gte" });
    rows.push({ kind: "price", compare: "lte" });
  }
  for (const indicatorKind of INDICATOR_KINDS) {
    for (const compare of INDICATOR_COMPARES) {
      rows.push({ kind: "indicator", indicatorKind, compare });
    }
  }
  return rows;
}

function applyDcaStart(
  seed: DcaTemplateRecipe,
  spec: DcaStartSpec,
  interval: DcaIndicatorTimeframe,
): DcaTemplateRecipe {
  if (spec.kind === "immediate") {
    return {
      ...seed,
      startKind: "immediate",
      armTrigger: null,
      indicatorKind: null,
      indicatorTimeframe: null,
      indicatorCompare: null,
      indicatorLevel: null,
    };
  }
  if (spec.kind === "price") {
    const price = seed.armTrigger?.price ?? 0;
    return {
      ...seed,
      startKind: "price",
      armTrigger: {
        triggerBy: seed.armTrigger?.triggerBy ?? "last",
        compare: spec.compare,
        price,
      },
      indicatorKind: null,
      indicatorTimeframe: null,
      indicatorCompare: null,
      indicatorLevel: null,
    };
  }
  return {
    ...seed,
    startKind: "indicator",
    armTrigger: null,
    indicatorKind: spec.indicatorKind,
    indicatorTimeframe: interval,
    indicatorCompare: spec.compare,
    indicatorLevel: indicatorLevel(spec.indicatorKind, spec.compare),
  };
}

function perpsTpslFromPct(
  seed: PerpsTemplateRecipe,
  trigger: number,
  tpPct: number | null,
  slPct: number | null,
): PerpsTemplateRecipe["tpsl"] {
  if (tpPct == null && slPct == null) {
    return null;
  }
  const long = seed.formAction !== "sell";
  const base = seed.tpsl ?? emptyFuturesTpsl();
  return {
    ...base,
    takeProfit:
      tpPct == null
        ? null
        : long
          ? trigger * (1 + tpPct / 100)
          : trigger * (1 - tpPct / 100),
    stopLoss:
      slPct == null
        ? null
        : long
          ? trigger * (1 - slPct / 100)
          : trigger * (1 + slPct / 100),
    tpOrderType: "market",
    slOrderType: "market",
    tpLimitPrice: null,
    slLimitPrice: null,
  };
}

function scenarioKey(row: StudyScenario): string {
  const recipe = row.recipe;
  if (recipe.kind === "dca") {
    return [
      row.interval,
      recipe.startKind,
      recipe.armTrigger?.compare ?? "",
      recipe.indicatorKind ?? "",
      recipe.indicatorCompare ?? "",
      String(recipe.takeProfitPct ?? ""),
      String(recipe.stopLossPct ?? ""),
    ].join("|");
  }
  return [
    row.interval,
    recipe.triggerCompare,
    String(recipe.tpsl?.takeProfit ?? ""),
    String(recipe.tpsl?.stopLoss ?? ""),
  ].join("|");
}

function capScenarios(
  rows: StudyScenario[],
  preferred: StudyScenario[],
  max: number,
): StudyScenario[] {
  if (rows.length <= max) {
    return rows;
  }
  const seen = new Set<string>();
  const out: StudyScenario[] = [];
  for (const row of preferred) {
    const key = scenarioKey(row);
    if (seen.has(key) || out.length >= max) {
      continue;
    }
    seen.add(key);
    out.push(row);
  }
  const rest = rows.filter((row) => !seen.has(scenarioKey(row)));
  const buckets = new Map<DcaIndicatorTimeframe, StudyScenario[]>();
  for (const row of rest) {
    const list = buckets.get(row.interval) ?? [];
    list.push(row);
    buckets.set(row.interval, list);
  }
  while (out.length < max) {
    let added = false;
    for (const interval of STUDY_INTERVALS) {
      const list = buckets.get(interval);
      if (!list || list.length === 0) {
        continue;
      }
      const next = list.shift();
      if (!next) {
        continue;
      }
      const key = scenarioKey(next);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(next);
      added = true;
      if (out.length >= max) {
        break;
      }
    }
    if (!added) {
      break;
    }
  }
  return out;
}

function expandDcaStudy(
  seed: DcaTemplateRecipe,
  intervals: DcaIndicatorTimeframe[],
): { rows: StudyScenario[]; preferred: StudyScenario[] } {
  const starts = dcaStarts(seed);
  const rows: StudyScenario[] = [];
  for (const interval of intervals) {
    for (const start of starts) {
      if (start.kind === "price" && !(seed.armTrigger && seed.armTrigger.price > 0)) {
        continue;
      }
      for (const takeProfitPct of STUDY_TP_PCTS) {
        for (const stopLossPct of STUDY_SL_PCTS) {
          const recipe: DcaTemplateRecipe = {
            ...applyDcaStart(seed, start, interval),
            takeProfitPct,
            stopLossPct,
          };
          recipe.name = scenarioName(seed.name, [
            startLabel(start),
            DCA_INDICATOR_TIMEFRAME_LABELS[interval],
            pctLabel(takeProfitPct, "TP"),
            pctLabel(stopLossPct, "SL"),
          ]);
          rows.push({
            interval,
            recipe,
            label: recipe.name,
          });
        }
      }
    }
  }
  const preferred = intervals.map((interval) => {
    const recipe: DcaTemplateRecipe = {
      ...seed,
      indicatorTimeframe:
        seed.startKind === "indicator" ? interval : seed.indicatorTimeframe,
    };
    recipe.name = scenarioName(seed.name, [
      "Desk seed",
      DCA_INDICATOR_TIMEFRAME_LABELS[interval],
    ]);
    return { interval, recipe, label: recipe.name };
  });
  return { rows: [...preferred, ...rows], preferred };
}

function expandPerpsStudy(
  seed: PerpsTemplateRecipe,
  intervals: DcaIndicatorTimeframe[],
): { rows: StudyScenario[]; preferred: StudyScenario[] } {
  const trigger = Number(String(seed.triggerPrice).replace(/,/g, "").trim());
  const compares: Array<PerpsTemplateRecipe["triggerCompare"]> = ["gte", "lte"];
  const rows: StudyScenario[] = [];
  for (const interval of intervals) {
    for (const triggerCompare of compares) {
      for (const tpPct of STUDY_TP_PCTS) {
        for (const slPct of STUDY_SL_PCTS) {
          const recipe: PerpsTemplateRecipe = {
            ...seed,
            entrySource: "price",
            triggerCompare,
            tpsl: perpsTpslFromPct(seed, trigger, tpPct, slPct),
          };
          recipe.name = scenarioName(seed.name, [
            triggerCompare === "gte" ? "When ≥" : "When ≤",
            DCA_INDICATOR_TIMEFRAME_LABELS[interval],
            pctLabel(tpPct, "TP"),
            pctLabel(slPct, "SL"),
          ]);
          rows.push({ interval, recipe, label: recipe.name });
        }
      }
    }
  }
  const preferred = intervals.map((interval) => {
    const recipe: PerpsTemplateRecipe = {
      ...seed,
      entrySource: "price",
      name: scenarioName(seed.name, [
        "Desk seed",
        DCA_INDICATOR_TIMEFRAME_LABELS[interval],
      ]),
    };
    return { interval, recipe, label: recipe.name };
  });
  return { rows: [...preferred, ...rows], preferred };
}

export function expandStudyScenarios(
  seed: BacktestRecipe,
  fromMs: number,
  toMs: number,
): { scenarios: StudyScenario[]; truncated: boolean } {
  const intervals = studyIntervalsForWindow(fromMs, toMs);
  if (intervals.length === 0) {
    return { scenarios: [], truncated: false };
  }
  if (seed.kind === "dca") {
    const { rows, preferred } = expandDcaStudy(seed, intervals);
    const capped = capScenarios(rows, preferred, STUDY_MAX_SCENARIOS);
    return { scenarios: capped, truncated: rows.length > capped.length };
  }
  if (
    seed.formAction === "close_long" ||
    seed.formAction === "close_short"
  ) {
    return { scenarios: [], truncated: false };
  }
  const { rows, preferred } = expandPerpsStudy(seed, intervals);
  const capped = capScenarios(rows, preferred, STUDY_MAX_SCENARIOS);
  return { scenarios: capped, truncated: rows.length > capped.length };
}

export function buildEquityTimeline(run: BacktestRun): EquityPoint[] {
  const points: EquityPoint[] = [
    {
      atMs: run.fromMs,
      equityUsdt: run.startingUsdt,
      realizedUsdt: 0,
      label: "Start",
    },
  ];
  let realized = 0;
  for (const order of run.orders) {
    if (order.realizedUsdt != null) {
      realized += order.realizedUsdt;
    }
    points.push({
      atMs: order.atMs,
      equityUsdt: run.startingUsdt + realized,
      realizedUsdt: realized,
      label: `${order.action} ${order.side}`,
    });
  }
  const ending = run.stats?.endingUsdt;
  const last = points[points.length - 1];
  if (
    ending != null &&
    last &&
    (Math.abs(ending - last.equityUsdt) > 1e-6 || run.toMs > last.atMs)
  ) {
    points.push({
      atMs: run.toMs,
      equityUsdt: ending,
      realizedUsdt: run.stats?.realizedUsdt ?? realized,
      label: run.stats?.openSide ? "Mark" : "End",
    });
  }
  return points;
}

export { recipeParamRows } from "./library";
