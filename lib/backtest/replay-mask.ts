import {
  DCA_BB_STDDEV,
  DEFAULT_DCA_ATR_BAND_MULT,
  DEFAULT_DCA_BB_PERIOD,
  DEFAULT_DCA_MA_PERIOD,
  DEFAULT_DCA_RSI_PERIOD,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DEFAULT_DCA_SUPERTREND_PERIOD,
  alignedAverage,
  atrValues,
  dcaIndicatorStartLatches,
  dcaPairCrossPeriods,
  emaValues,
  macdHistogramLevel,
  macdSeries,
  resampleBarsForTimeframe,
  rsiSeries,
  smaValues,
  supertrendSeries,
  type DcaIndicatorCompare,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import { defaultDcaFilterPeriod, type DcaFilterSpec } from "@/lib/dca/filters";
import type { DcaIndicatorStart } from "@/lib/dca/playbook";
import { exitStackMet } from "@/lib/dca/exit-stack";
import { hardExitMet, hardExitSignalFromJson } from "@/lib/dca/hard-exit";
import { perpsExitForSide } from "@/lib/futures/conditions";
import type { FuturesSide } from "@/lib/futures/model";
import type { CandleBar } from "@/lib/market/candles";
import { formatStrategyLeafReason } from "@/lib/bots/condition-copy";
import {
  addStackGroupIndex,
  addStackGroups,
  addStackMet,
  entryStackMet,
  resolveEntryStack,
  type EntryStack,
  type StrategyLeaf,
} from "@/lib/strategy/expr";
import { protectionMet, type ProtectionReading } from "@/lib/strategy/protection";
import type { PerpsTemplateRecipe } from "@/lib/templates/recipe";
import {
  formatRetraceLabel,
  positionRetraceMet,
  retraceMet,
  windowRetraceSpec,
  type PositionRetraceContext,
  type RetraceSpec,
} from "@/lib/strategy/retrace";
import { rsiDivergenceMet } from "@/lib/strategy/rsi-divergence";
import { intervalMs } from "./model";

export type ReplayEntryInput = {
  side: FuturesSide;
  entrySource: PerpsTemplateRecipe["entrySource"];
  triggerCompare: "gte" | "lte";
  triggerPrice: number;
  indicator: DcaIndicatorStart | null;
  confirm: DcaFilterSpec | null;
  entryStack: EntryStack | null;
  retrace?: RetraceSpec | null;
};

type Frame = {
  bars: CandleBar[];
  closes: number[];
  /** Last resampled index in the prefix, before an open bar is dropped. */
  rawEnd: number[];
  /** Last resampled index indicators on the entry path actually see. */
  closedEnd: number[];
};

type Band = { mid: number; upper: number; lower: number };

type TrendCursor = {
  now: Array<1 | -1 | null>;
  prev: Array<1 | -1 | null>;
};

/**
 * One pass over the tape. Entry and exit checks then read the bar index
 * instead of rebuilding Supertrend, RSI, and MACD on every candle.
 */
export class ReplayBook {
  private readonly frames = new Map<DcaIndicatorTimeframe, Frame>();
  private readonly rsi = new Map<string, (number | null)[]>();
  private readonly ema = new Map<string, (number | null)[]>();
  private readonly sma = new Map<string, (number | null)[]>();
  private readonly macd = new Map<string, (number | null)[]>();
  private readonly trend = new Map<string, TrendCursor>();
  private readonly atr = new Map<string, (number | null)[]>();
  private readonly bands = new Map<string, Array<Band | null>>();

  constructor(
    private readonly tapeBars: CandleBar[],
    private readonly tape: DcaIndicatorTimeframe,
    private readonly nowMs: number,
  ) {}

  entryMask(input: ReplayEntryInput): boolean[] {
    const out = new Array<boolean>(this.tapeBars.length).fill(false);
    for (let index = 0; index < this.tapeBars.length; index += 1) {
      const price = this.tapeBars[index]?.close ?? 0;
      if (!(price > 0)) {
        continue;
      }
      out[index] = this.entryAt(input, index, price);
    }
    return out;
  }

  exitMask(recipe: PerpsTemplateRecipe, side: FuturesSide): boolean[] {
    const exit = perpsExitForSide(
      {
        ...recipe,
        exitIf: recipe.exitIf ?? null,
        exitHard: hardExitSignalFromJson(recipe.exitHard),
      },
      side,
    );
    const out = new Array<boolean>(this.tapeBars.length).fill(false);
    for (let index = 0; index < this.tapeBars.length; index += 1) {
      const price = this.tapeBars[index]?.close ?? 0;
      if (!(price > 0)) {
        continue;
      }
      const quotes = { last: price, mark: price, index: price };
      const first = exit.exitHard
        ? hardExitMet({
            signal: exit.exitHard,
            side,
            prices: quotes,
          })
        : Boolean(exit.exitIf) &&
          this.filterAt(exit.exitIf, side, index, false);
      out[index] =
        exit.exitStack.leaves.length === 0
          ? first
          : exitStackMet({
              first,
              joins: exit.exitStack.joins,
              leaves: exit.exitStack.leaves.map((leaf) =>
                this.exitLeafAt(leaf, side, index, price),
              ),
            });
    }
    return out;
  }

  /**
   * Additional-order stack at one tape bar.
   * The first fully true Or group supplies the size and the log sentence.
   */
  addDetail(
    stack: EntryStack,
    side: FuturesSide,
    index: number,
    protection?: ProtectionReading | null,
    positionRetrace?: PositionRetraceContext | null,
  ): { met: boolean; group: number | null; because: string } {
    const price = this.tapeBars[index]?.close ?? 0;
    const flags = stack.leaves.map((leaf) => {
      if (leaf.kind === "protection") {
        return protectionMet({
          spec: leaf,
          openQty: protection?.openQty ?? null,
          provenPct: protection?.provenPct ?? null,
          noLossProvenPct: protection?.noLossProvenPct ?? null,
        });
      }
      if (leaf.kind === "retrace") {
        if (!positionRetrace) {
          return false;
        }
        return positionRetraceMet({
          spec: leaf,
          side,
          price,
          average: positionRetrace.average,
          memory: positionRetrace.memory,
        });
      }
      return this.entryLeafAt(leaf, side, index, price);
    });
    const group = addStackGroupIndex({ stack, leaves: flags });
    const because =
      group == null
        ? ""
        : (addStackGroups(stack)[group] ?? [])
            .map((leaf) =>
              leaf.kind === "retrace"
                ? formatRetraceLabel({ ...leaf, lookback: null, timeframe: null })
                : formatStrategyLeafReason(leaf, side),
            )
            .filter(Boolean)
            .join(", and ");
    return {
      met: addStackMet({ stack, leaves: flags }),
      group,
      because,
    };
  }

  /** Prefix the fill sentence saw: resampled bars, including a still-open last bar. */
  barsAt(
    index: number,
    timeframes: readonly DcaIndicatorTimeframe[],
  ): Map<DcaIndicatorTimeframe, CandleBar[]> {
    const map = new Map<DcaIndicatorTimeframe, CandleBar[]>();
    for (const timeframe of timeframes) {
      const frame = this.frame(timeframe);
      const end = frame.rawEnd[index] ?? -1;
      map.set(timeframe, end < 0 ? [] : frame.bars.slice(0, end + 1));
    }
    return map;
  }

  private entryAt(
    input: ReplayEntryInput,
    index: number,
    price: number,
  ): boolean {
    const stack = resolveEntryStack(input.entryStack, input.confirm);
    return entryStackMet({
      trigger: this.startAt(input, index, price),
      joins: stack.joins,
      leaves: stack.leaves.map((leaf) => this.entryLeafAt(leaf, input.side, index, price)),
    });
  }

  private startAt(
    input: ReplayEntryInput,
    index: number,
    price: number,
  ): boolean {
    if (input.entrySource === "webhook") {
      return true;
    }
    if (input.entrySource === "price") {
      return input.triggerCompare === "gte"
        ? price >= input.triggerPrice
        : price <= input.triggerPrice;
    }
    if (input.entrySource === "retrace") {
      return this.retraceAt(input.retrace, index, price);
    }
    const start = input.indicator;
    if (!start) {
      return false;
    }
    if (start.kind === "rsi_divergence") {
      return this.divergenceAt(start, index);
    }
    return this.seriesStartAt(start, input.side, index);
  }

  private entryLeafAt(
    leaf: StrategyLeaf,
    side: FuturesSide,
    index: number,
    price: number,
  ): boolean {
    if (leaf.kind === "filter") {
      return this.filterAt(leaf.spec, side, index, false);
    }
    if (leaf.kind === "price") {
      if (!(price > 0)) {
        return false;
      }
      return leaf.compare === "gte" ? price >= leaf.price : price <= leaf.price;
    }
    if (leaf.kind === "webhook" || leaf.kind === "protection") {
      return false;
    }
    if (leaf.kind === "retrace") {
      return this.retraceAt(windowRetraceSpec(leaf), index, price);
    }
    if (leaf.start.kind === "rsi_divergence") {
      return this.divergenceAt(leaf.start, index);
    }
    return this.seriesStartAt(leaf.start, side, index);
  }

  private exitLeafAt(
    leaf: StrategyLeaf,
    side: FuturesSide,
    index: number,
    price: number,
  ): boolean {
    if (leaf.kind === "filter") {
      return this.filterAt(leaf.spec, side, index, true);
    }
    if (leaf.kind === "price") {
      if (!(price > 0)) {
        return false;
      }
      return leaf.compare === "gte" ? price >= leaf.price : price <= leaf.price;
    }
    if (leaf.kind === "retrace") {
      return this.retraceAt(windowRetraceSpec(leaf), index, price);
    }
    if (
      (leaf.kind === "indicator" || leaf.kind === "trend") &&
      leaf.start.kind === "rsi_divergence"
    ) {
      return this.divergenceAt(leaf.start, index);
    }
    return false;
  }

  private seriesStartAt(
    start: DcaIndicatorStart,
    side: FuturesSide,
    index: number,
  ): boolean {
    const end = this.frame(start.timeframe).closedEnd[index] ?? -1;
    const met = this.indicatorAt(start, side, end);
    if (!dcaIndicatorStartLatches(start.kind, start.compare)) {
      return met;
    }
    if (end + 1 > 2) {
      return met || this.indicatorAt(start, side, end - 1);
    }
    return met;
  }

  private filterAt(
    spec: DcaFilterSpec | null | undefined,
    side: FuturesSide,
    index: number,
    raw: boolean,
  ): boolean {
    if (!spec) {
      return true;
    }
    const frame = this.frame(spec.timeframe);
    const end = (raw ? frame.rawEnd[index] : frame.closedEnd[index]) ?? -1;
    return this.filterAtEnd(spec, side, end);
  }

  private filterAtEnd(
    spec: DcaFilterSpec,
    side: FuturesSide,
    end: number,
  ): boolean {
    if (end < 0) {
      return false;
    }
    if (spec.kind === "rsi_divergence") {
      const frame = this.frame(spec.timeframe);
      return rsiDivergenceMet({
        bars: frame.bars.slice(0, end + 1),
        period: spec.period,
        settings: spec.divergence,
      });
    }
    if (spec.kind === "atr_band") {
      return this.atrBandAt(
        spec.timeframe,
        end,
        spec.period ?? defaultDcaFilterPeriod("atr_band"),
        spec.multiplier ?? DEFAULT_DCA_ATR_BAND_MULT,
        spec.compare === "inside" ||
          spec.compare === "lte" ||
          spec.compare === "gte" ||
          spec.compare === "cross_lte" ||
          spec.compare === "cross_gte"
          ? spec.compare
          : "gte",
      );
    }
    if (
      spec.kind === "macd" ||
      spec.kind === "ema_cross" ||
      spec.kind === "sma_cross"
    ) {
      return this.indicatorAt(filterStart(spec), side, end);
    }
    if (spec.kind === "bb" && spec.compare === "inside") {
      const bands = this.bandSeries(
        spec.timeframe,
        spec.period ?? defaultDcaFilterPeriod("bb"),
      );
      const price = this.frame(spec.timeframe).closes[end];
      const row = bands[end];
      return Boolean(
        row && price != null && price >= row.lower && price <= row.upper,
      );
    }
    if (spec.kind === "rsi" && spec.compare === "between") {
      const rsi = this.rsiSeries(
        spec.timeframe,
        spec.period ?? defaultDcaFilterPeriod("rsi"),
      )[end];
      const from = spec.level;
      const to = spec.levelTo;
      return (
        rsi != null &&
        from != null &&
        to != null &&
        rsi >= from &&
        rsi <= to
      );
    }
    if (spec.compare === "inside" || spec.compare === "between") {
      return false;
    }
    return this.indicatorAt(filterStart(spec), side, end);
  }

  private indicatorAt(
    start: DcaIndicatorStart,
    side: FuturesSide,
    end: number,
  ): boolean {
    if (end < 0) {
      return false;
    }
    const compare = start.compare;
    const cross = compare === "cross_gte" || compare === "cross_lte";
    const frame = this.frame(start.timeframe);
    if (start.kind === "supertrend") {
      const cursor = this.trendCursor(
        start.timeframe,
        start.period ?? DEFAULT_DCA_SUPERTREND_PERIOD,
        start.multiplier ?? DEFAULT_DCA_SUPERTREND_MULTIPLIER,
      );
      const now = cursor.now[end];
      if (now == null) {
        return false;
      }
      const bullish =
        compare === "gte" || compare === "cross_gte";
      if (cross) {
        const prev = cursor.prev[end];
        if (prev == null) {
          return false;
        }
        return bullish ? prev === -1 && now === 1 : prev === 1 && now === -1;
      }
      return bullish ? now === 1 : now === -1;
    }
    if (start.kind === "atr_band") {
      return this.atrBandAt(
        start.timeframe,
        end,
        start.period ?? DEFAULT_DCA_SUPERTREND_PERIOD,
        start.multiplier ?? DEFAULT_DCA_ATR_BAND_MULT,
        compare ?? "gte",
      );
    }
    if (start.kind === "bb") {
      const period = start.period ?? DEFAULT_DCA_BB_PERIOD;
      const row = this.bandSeries(start.timeframe, period)[end];
      const price = frame.closes[end];
      if (!row || price == null) {
        return false;
      }
      const below = compare === "lte" || compare === "cross_lte";
      if (cross) {
        const prev = end > 0 ? this.bandSeries(start.timeframe, period)[end - 1] : null;
        const prevPrice = end > 0 ? frame.closes[end - 1] : null;
        if (!prev || prevPrice == null) {
          return false;
        }
        return below
          ? prevPrice >= prev.lower && price < row.lower
          : prevPrice <= prev.upper && price > row.upper;
      }
      return below ? price < row.lower : price > row.upper;
    }
    if (start.kind === "ema" || start.kind === "sma") {
      const period = start.period ?? DEFAULT_DCA_MA_PERIOD;
      const averages =
        start.kind === "sma"
          ? this.smaSeries(start.timeframe, period)
          : this.emaSeries(start.timeframe, period);
      const price = frame.closes[end];
      const average = averages[end];
      if (price == null || average == null) {
        return false;
      }
      if (!cross && (compare === "gte" || compare === "lte")) {
        return compare === "lte" ? price < average : price > average;
      }
      const prevPrice = end > 0 ? frame.closes[end - 1] : null;
      const prevAverage = end > 0 ? averages[end - 1] : null;
      if (prevPrice == null || prevAverage == null) {
        return false;
      }
      const up = compare !== "cross_lte";
      return up
        ? prevPrice < prevAverage && price >= average
        : prevPrice > prevAverage && price <= average;
    }
    if (start.kind === "rsi") {
      if (start.level === null || !compare) {
        return false;
      }
      const series = this.rsiSeries(
        start.timeframe,
        start.period ?? DEFAULT_DCA_RSI_PERIOD,
      );
      const now = series[end];
      if (now == null) {
        return false;
      }
      if (cross) {
        const prev = end > 0 ? series[end - 1] : null;
        if (prev == null) {
          return false;
        }
        const up = compare === "cross_gte";
        return up ? prev < start.level && now >= start.level : prev > start.level && now <= start.level;
      }
      return compare === "gte" ? now >= start.level : now <= start.level;
    }
    if (start.kind === "macd") {
      const level = macdHistogramLevel(start.level);
      const series = this.macdSeries(start.timeframe);
      const now = series[end];
      if (now == null) {
        return false;
      }
      if (cross) {
        const prev = end > 0 ? series[end - 1] : null;
        if (prev == null) {
          return false;
        }
        const up = compare !== "cross_lte";
        return up ? prev < level && now >= level : prev > level && now <= level;
      }
      if (compare === "lte") {
        return now < level;
      }
      return now > level;
    }
    if (start.kind === "ema_cross" || start.kind === "sma_cross") {
      if (start.kind === "ema_cross" && start.level != null && cross) {
        const series = this.emaSeries(start.timeframe, 21);
        const now = series[end];
        const prev = end > 0 ? series[end - 1] : null;
        if (now == null || prev == null) {
          return false;
        }
        const up = compare !== "cross_lte";
        return up ? prev < start.level && now >= start.level : prev > start.level && now <= start.level;
      }
      const { fast, slow } = dcaPairCrossPeriods(start.period, start.slowPeriod);
      const fastSeries =
        start.kind === "sma_cross"
          ? this.smaSeries(start.timeframe, fast)
          : this.emaSeries(start.timeframe, fast);
      const slowSeries =
        start.kind === "sma_cross"
          ? this.smaSeries(start.timeframe, slow)
          : this.emaSeries(start.timeframe, slow);
      const fastNow = fastSeries[end];
      const slowNow = slowSeries[end];
      const fastPrev = end > 0 ? fastSeries[end - 1] : null;
      const slowPrev = end > 0 ? slowSeries[end - 1] : null;
      if (
        fastNow == null ||
        slowNow == null ||
        fastPrev == null ||
        slowPrev == null
      ) {
        return false;
      }
      const up = compare !== "cross_lte";
      return up
        ? fastNow > slowNow && fastPrev <= slowPrev
        : fastNow < slowNow && fastPrev >= slowPrev;
    }
    void side;
    return false;
  }

  private atrBandAt(
    timeframe: DcaIndicatorTimeframe,
    end: number,
    period: number,
    multiplier: number,
    compare: DcaIndicatorCompare | "inside",
  ): boolean {
    if (!(multiplier > 0) || end < period) {
      return false;
    }
    const atr = this.atrSeries(timeframe, period)[end];
    const mid = this.emaSeries(timeframe, period)[end];
    const price = this.frame(timeframe).closes[end];
    if (atr == null || !(atr > 0) || mid == null || price == null) {
      return false;
    }
    const upper = mid + atr * multiplier;
    const lower = mid - atr * multiplier;
    if (compare === "inside") {
      return price >= lower && price <= upper;
    }
    if (compare === "lte" || compare === "cross_lte") {
      return price <= lower;
    }
    return price >= upper;
  }

  private retraceAt(
    spec: RetraceSpec | null | undefined,
    index: number,
    price: number,
  ): boolean {
    if (!spec || !(price > 0)) {
      return false;
    }
    const frame = this.frame(spec.timeframe);
    const end = frame.closedEnd[index] ?? -1;
    if (end < 0) {
      return false;
    }
    return retraceMet({
      spec,
      price,
      bars: frame.bars.slice(0, end + 1),
    });
  }

  private divergenceAt(start: DcaIndicatorStart, index: number): boolean {
    const frame = this.frame(start.timeframe);
    const end = frame.closedEnd[index] ?? -1;
    if (end < 0) {
      return false;
    }
    return rsiDivergenceMet({
      bars: frame.bars.slice(0, end + 1),
      period: start.period,
      settings: start.divergence,
    });
  }

  private frame(timeframe: DcaIndicatorTimeframe): Frame {
    const cached = this.frames.get(timeframe);
    if (cached) {
      return cached;
    }
    const step = timeframeStep(this.tape, timeframe);
    const sampled =
      step === 1
        ? this.tapeBars.map((row) => ({
            timeMs: row.timeMs,
            open: row.close,
            high: row.high,
            low: row.low,
            close: row.close,
          }))
        : resampleBarsForTimeframe(this.tapeBars, this.tape, timeframe).map(
            (row, index) => ({
              timeMs: this.tapeBars[Math.min(index, this.tapeBars.length - 1)]?.timeMs ?? index,
              open: row.close,
              high: row.high,
              low: row.low,
              close: row.close,
            }),
          );
    const span = intervalMs(timeframe);
    const rawEnd = new Array<number>(this.tapeBars.length);
    const closedEnd = new Array<number>(this.tapeBars.length);
    for (let index = 0; index < this.tapeBars.length; index += 1) {
      const count = step === 1 ? index + 1 : Math.floor((index + 1) / step);
      const raw = count - 1;
      rawEnd[index] = raw;
      const bar = raw >= 0 ? sampled[raw] : undefined;
      const open = Boolean(bar && this.nowMs < bar.timeMs + span);
      closedEnd[index] = open ? raw - 1 : raw;
    }
    const frame = {
      bars: sampled,
      rawEnd,
      closedEnd,
      closes: sampled.map((row) => row.close),
    };
    this.frames.set(timeframe, frame);
    return frame;
  }

  private rsiSeries(
    timeframe: DcaIndicatorTimeframe,
    period: number,
  ): (number | null)[] {
    const key = `${timeframe}:rsi:${period}`;
    const cached = this.rsi.get(key);
    if (cached) {
      return cached;
    }
    const series = rsiSeries(this.frame(timeframe).closes, period);
    this.rsi.set(key, series);
    return series;
  }

  private emaSeries(
    timeframe: DcaIndicatorTimeframe,
    period: number,
  ): (number | null)[] {
    const key = `${timeframe}:ema:${period}`;
    const cached = this.ema.get(key);
    if (cached) {
      return cached;
    }
    const closes = this.frame(timeframe).closes;
    const series = alignedAverage(closes, emaValues(closes, period));
    this.ema.set(key, series);
    return series;
  }

  private smaSeries(
    timeframe: DcaIndicatorTimeframe,
    period: number,
  ): (number | null)[] {
    const key = `${timeframe}:sma:${period}`;
    const cached = this.sma.get(key);
    if (cached) {
      return cached;
    }
    const closes = this.frame(timeframe).closes;
    const series = alignedAverage(closes, smaValues(closes, period));
    this.sma.set(key, series);
    return series;
  }

  private macdSeries(timeframe: DcaIndicatorTimeframe): (number | null)[] {
    const key = `${timeframe}:macd`;
    const cached = this.macd.get(key);
    if (cached) {
      return cached;
    }
    const series = macdSeries(this.frame(timeframe).closes).histogram;
    this.macd.set(key, series);
    return series;
  }

  private trendCursor(
    timeframe: DcaIndicatorTimeframe,
    period: number,
    multiplier: number,
  ): TrendCursor {
    const key = `${timeframe}:st:${period}:${multiplier}`;
    const cached = this.trend.get(key);
    if (cached) {
      return cached;
    }
    const points = supertrendSeries(this.frame(timeframe).bars, period, multiplier);
    const now: Array<1 | -1 | null> = [];
    const prev: Array<1 | -1 | null> = [];
    let last: 1 | -1 | null = null;
    let prior: 1 | -1 | null = null;
    for (let index = 0; index < points.length; index += 1) {
      const dir = points[index]?.dir ?? null;
      if (dir != null) {
        prior = last;
        last = dir;
      }
      now.push(last);
      prev.push(prior);
    }
    const cursor = { now, prev };
    this.trend.set(key, cursor);
    return cursor;
  }

  private atrSeries(
    timeframe: DcaIndicatorTimeframe,
    period: number,
  ): (number | null)[] {
    const key = `${timeframe}:atr:${period}`;
    const cached = this.atr.get(key);
    if (cached) {
      return cached;
    }
    const values = atrValues(this.frame(timeframe).bars, period);
    const series =
      values.length === this.frame(timeframe).bars.length
        ? values
        : this.frame(timeframe).bars.map((_, index) => values[index] ?? null);
    this.atr.set(key, series);
    return series;
  }

  private bandSeries(
    timeframe: DcaIndicatorTimeframe,
    period: number,
  ): Array<Band | null> {
    const key = `${timeframe}:bb:${period}`;
    const cached = this.bands.get(key);
    if (cached) {
      return cached;
    }
    const closes = this.frame(timeframe).closes;
    const out: Array<Band | null> = closes.map(() => null);
    if (period >= 2) {
      let sum = 0;
      let sumSq = 0;
      for (let index = 0; index < closes.length; index += 1) {
        const value = closes[index] ?? 0;
        sum += value;
        sumSq += value * value;
        if (index >= period) {
          const old = closes[index - period] ?? 0;
          sum -= old;
          sumSq -= old * old;
        }
        if (index >= period - 1) {
          const mid = sum / period;
          const variance = Math.max(0, sumSq / period - mid * mid);
          const band = Math.sqrt(variance) * DCA_BB_STDDEV;
          out[index] = { mid, upper: mid + band, lower: mid - band };
        }
      }
    }
    this.bands.set(key, out);
    return out;
  }
}

function filterStart(spec: DcaFilterSpec): DcaIndicatorStart {
  const crossKind =
    spec.kind === "macd" ||
    spec.kind === "ema_cross" ||
    spec.kind === "sma_cross";
  const compare = crossKind
    ? spec.compare === "gte" ||
      spec.compare === "lte" ||
      spec.compare === "cross_gte" ||
      spec.compare === "cross_lte"
      ? spec.compare
      : "cross_gte"
    : spec.compare === "inside" || spec.compare === "between"
      ? null
      : spec.compare;
  return {
    kind: spec.kind,
    timeframe: spec.timeframe,
    compare,
    level: crossKind && spec.kind !== "macd" ? null : spec.level,
    period: spec.period,
    slowPeriod: spec.slowPeriod ?? null,
    multiplier: spec.multiplier,
  };
}

function timeframeStep(
  tape: DcaIndicatorTimeframe,
  timeframe: DcaIndicatorTimeframe,
): number {
  if (tape === timeframe) {
    return 1;
  }
  const step = Math.round(intervalMs(timeframe) / intervalMs(tape));
  return step > 1 ? step : 1;
}
