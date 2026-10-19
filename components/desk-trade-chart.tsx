"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { AutoscaleInfo } from "lightweight-charts";
import {
  ChartContextMenu,
  type ChartContextMenuState,
} from "@/components/chart-context-menu";
import type { ChartSnapshot } from "@/components/chart-screenshot";
import { ClickGateNotice, useClickGate } from "@/components/click-gate-notice";
import {
  IconCollapse,
  IconExitMonitor,
  IconExpand,
  IconLoader,
  IconMonitor,
} from "@/components/icons";
import { ReplayChartBar } from "@/components/replay-chart-bar";
import { ReplayIndicatorLegend } from "@/components/replay-indicator-legend";
import {
  ResearchTrialLines,
  useResearchGateAccess,
} from "@/components/research-gate-access";
import {
  clearReplayChartFields,
  colorWithOpacity,
  defaultReplayChartAppearance,
  mergeReplayChartAppearance,
  patchReplayChartAppearance,
  pickReplayChartFields,
  replayGridPaint,
  resetReplayChartFields,
  saveReplayChartAppearance,
  serializeReplayChartAppearance,
  type ReplayChartAppearancePatch,
} from "@/lib/backtest/chart-appearance";
import {
  deskChartSeries,
  deskIndicatorCatalog,
  indicatorStyleTargets,
  oscillatorPaneStretch,
  replayIndicatorLegend,
  visiblePriceBounds,
  type ReplayReferenceInputs,
} from "@/lib/backtest/chart-series";
import {
  indicatorLineStyle,
  resetIndicatorStyle,
  saveIndicatorStyleGlobal,
  writeIndicatorLineStyle,
  type IndicatorLineStyle,
  type IndicatorStyleMap,
} from "@/lib/backtest/indicator-style";
import { attachRightAxisWheel, CHART_SCALE_OPTIONS } from "@/lib/charts/interact";
import {
  DESK_CHART_VIEW_KEY,
  readDeskChartView,
  serializeDeskChartView,
  type DeskChartView,
} from "@/lib/charts/desk-chart-view";
import { indicatorAddDenial, researchTrialLine } from "@/lib/membership/entitlements";
import { DESK_CANDLE_LIMIT, type CandleBar, type CandleVenue } from "@/lib/market/candles";
import { rsiDivergenceLine } from "@/lib/strategy/rsi-divergence";

const EMPTY_CANDLES: CandleBar[] = [];
const DESK_CHART_EVENT = "tbp-desk-chart";
const FRAME_ICON = { size: 16, className: "size-4" } as const;
const TOOL_BUTTON =
  "inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink";

type WebkitFullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};

type WebkitFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

function monitorFullscreenElement(): Element | null {
  const doc = document as WebkitFullscreenDocument;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function requestMonitorFullscreen(node: HTMLElement) {
  const el = node as WebkitFullscreenElement;
  const request = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
  if (!request) {
    return Promise.reject(new Error("Fullscreen is not available."));
  }
  return request();
}

function exitMonitorFullscreen() {
  const doc = document as WebkitFullscreenDocument;
  const exit = document.exitFullscreen?.bind(document) ?? doc.webkitExitFullscreen?.bind(doc);
  if (!exit) {
    return Promise.resolve();
  }
  return exit();
}

function cssVar(node: HTMLElement, name: string, fallback: string): string {
  const value = getComputedStyle(node).getPropertyValue(name).trim();
  return value || fallback;
}

function styledLineColor(
  node: HTMLElement,
  style: IndicatorLineStyle,
  fallback: string,
): string {
  const base = !style.color
    ? fallback
    : style.color.startsWith("#")
      ? style.color
      : cssVar(node, `--color-${style.color}`, fallback);
  return style.opacity >= 100 ? base : colorWithOpacity(base, style.opacity);
}

function appearanceColor(
  node: HTMLElement,
  token: string | null,
  fallbackName: string,
  fallbackHex: string,
  opacity = 100,
): string {
  const base = !token
    ? cssVar(node, fallbackName, fallbackHex)
    : token.startsWith("#")
      ? token
      : cssVar(node, `--color-${token}`, fallbackHex);
  return opacity >= 100 ? base : colorWithOpacity(base, opacity);
}

function lineData(candles: CandleBar[], values: (number | null)[]) {
  const rows: Array<{ time: number; value?: number }> = [];
  let started = false;
  for (let i = 0; i < candles.length; i += 1) {
    const timeMs = candles[i]?.timeMs;
    if (!(timeMs != null && timeMs > 0)) {
      continue;
    }
    const time = Math.floor(timeMs / 1000);
    const value = values[i];
    if (value == null) {
      if (started) {
        rows.push({ time });
      }
      continue;
    }
    started = true;
    rows.push({ time, value });
  }
  return rows;
}

function subscribeDeskChart(onStoreChange: () => void) {
  window.addEventListener(DESK_CHART_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(DESK_CHART_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function readDeskChartRaw(): string {
  try {
    return window.localStorage.getItem(DESK_CHART_VIEW_KEY) ?? "";
  } catch {
    return "";
  }
}

function serverDeskChartRaw() {
  return "";
}

function commitDeskChart(next: DeskChartView) {
  try {
    window.localStorage.setItem(DESK_CHART_VIEW_KEY, serializeDeskChartView(next));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(DESK_CHART_EVENT));
}

function sameReferenceIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const seen = new Set(left);
  return right.every((id) => seen.has(id));
}

type LoadState = {
  key: string;
  candles: CandleBar[];
  error: string | null;
};

export function DeskTradeChart({
  venue,
  environment = null,
  symbol,
}: {
  venue: CandleVenue;
  environment?: string | null;
  symbol: string;
}) {
  const rawView = useSyncExternalStore(
    subscribeDeskChart,
    readDeskChartRaw,
    serverDeskChartRaw,
  );
  const view = useMemo(() => readDeskChartView(rawView || null), [rawView]);
  const interval = view.interval;
  const favoriteIntervals = view.favoriteIntervals;
  const references = view.referenceIndicators;
  const referenceInputs = view.referenceInputs;
  const savedAppearance = view.chartAppearance;
  const savedStyles = view.indicatorStyles;
  const [sessionAppearance, setSessionAppearance] = useState<ReplayChartAppearancePatch>({});
  const [sessionStyles, setSessionStyles] = useState<IndicatorStyleMap>({});
  const [appliedReferences, setAppliedReferences] = useState<string[]>([]);
  const [load, setLoad] = useState<LoadState>({ key: "", candles: [], error: null });
  const [legendIndex, setLegendIndex] = useState<number | null>(null);
  const [oscillatorTops, setOscillatorTops] = useState<number[]>([]);
  const [chartMenu, setChartMenu] = useState<ChartContextMenuState>(null);
  const [expanded, setExpanded] = useState(false);
  const [monitorFull, setMonitorFull] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const chartShotRef = useRef<ChartSnapshot | null>(null);
  const resetChartRef = useRef<(() => void) | null>(null);
  const resetPriceRef = useRef<(() => void) | null>(null);
  const paintRef = useRef<((resetView: boolean) => void) | null>(null);
  const syncIndicatorsRef = useRef<(() => void) | null>(null);
  const applyAppearanceRef = useRef<(() => void) | null>(null);
  const applyIndicatorStylesRef = useRef<(() => void) | null>(null);
  const chartAppearance = useMemo(
    () => mergeReplayChartAppearance(savedAppearance, sessionAppearance),
    [savedAppearance, sessionAppearance],
  );
  const referencesRef = useRef(references);
  const chartAppearanceRef = useRef(chartAppearance);
  const styleStateRef = useRef({ session: sessionStyles, saved: savedStyles });
  const researchGate = useResearchGateAccess();
  const indicatorGate = useClickGate();
  const indicatorChoices = useMemo(() => deskIndicatorCatalog(), []);
  const chartKey = `${venue}:${environment ?? ""}:${symbol}:${interval}`;
  const matched = load.key === chartKey;
  const candles = matched ? load.candles : EMPTY_CANDLES;
  const error = matched ? load.error : null;
  const candlesRef = useRef(candles);
  const series = useMemo(
    () => deskChartSeries(candles, references, referenceInputs),
    [candles, references, referenceInputs],
  );
  const seriesRef = useRef(series);
  useEffect(() => {
    referencesRef.current = references;
    chartAppearanceRef.current = chartAppearance;
    styleStateRef.current = { session: sessionStyles, saved: savedStyles };
    candlesRef.current = candles;
    seriesRef.current = series;
  }, [candles, chartAppearance, references, savedStyles, series, sessionStyles]);
  const legendAt = legendIndex ?? Math.max(0, candles.length - 1);
  const legendRows = useMemo(
    () => replayIndicatorLegend(series.layers, legendAt),
    [legendAt, series],
  );
  const styleTargets = useMemo(() => {
    const targets: Record<string, ReturnType<typeof indicatorStyleTargets>> = {};
    for (const layer of series.layers) {
      targets[layer.id] = indicatorStyleTargets(layer);
    }
    return targets;
  }, [series]);
  const styleNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const layer of series.layers) {
      names[layer.id] = layer.title;
    }
    return names;
  }, [series]);
  const indicatorInputs = useMemo(() => {
    const fields: Record<string, (typeof series.layers)[number]["inputs"]> = {};
    const locked: Record<string, boolean> = {};
    const timeframes: Record<string, string> = {};
    for (const layer of series.layers) {
      fields[layer.id] = layer.inputs;
      locked[layer.id] = layer.inputsLocked;
      timeframes[layer.id] = layer.timeframeLabel;
    }
    return { fields, locked, timeframes };
  }, [series]);

  useEffect(() => {
    if (!symbol) {
      return;
    }
    const key = chartKey;
    const controller = new AbortController();
    let cancelled = false;
    async function pull(silent: boolean) {
      if (silent && document.visibilityState === "hidden") {
        return;
      }
      const params = new URLSearchParams({
        venue,
        symbol,
        interval,
        limit: String(DESK_CANDLE_LIMIT),
      });
      if (environment) {
        params.set("env", environment);
      }
      try {
        const response = await fetch(`/api/market/candles?${params.toString()}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as { candles?: CandleBar[]; error?: string };
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setLoad((current) =>
            current.key === key && current.candles.length > 0
              ? current
              : {
                  key,
                  candles: [],
                  error: body.error || "Could not read candles.",
                },
          );
          return;
        }
        setLoad({ key, candles: body.candles ?? [], error: null });
      } catch (pullError) {
        if (
          cancelled ||
          (pullError instanceof DOMException && pullError.name === "AbortError")
        ) {
          return;
        }
        setLoad((current) =>
          current.key === key && current.candles.length > 0
            ? current
            : { key, candles: [], error: "Could not read candles." },
        );
      }
    }
    void pull(false);
    const timer = window.setInterval(() => {
      void pull(true);
    }, 15_000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [chartKey, environment, interval, symbol, venue]);

  useEffect(() => {
    function syncFs() {
      const node = frameRef.current;
      setMonitorFull(node != null && monitorFullscreenElement() === node);
    }
    document.addEventListener("fullscreenchange", syncFs);
    document.addEventListener("webkitfullscreenchange", syncFs);
    return () => {
      document.removeEventListener("fullscreenchange", syncFs);
      document.removeEventListener("webkitfullscreenchange", syncFs);
    };
  }, []);

  useEffect(() => {
    if (!expanded || monitorFull) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !monitorFullscreenElement()) {
        setExpanded(false);
      }
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded, monitorFull]);

  const ready = candles.length > 0;
  useEffect(() => {
    const host = hostRef.current;
    if (!ready || !host) {
      return;
    }
    let disposed = false;
    let cleanup = () => {};
    void import("lightweight-charts").then((charts) => {
      if (disposed || !hostRef.current) {
        return;
      }
      const node = hostRef.current;
      const chart = charts.createChart(node, {
        layout: {
          background: {
            type: charts.ColorType.Solid,
            color: cssVar(node, "--color-canvas", "#0B0E14"),
          },
          textColor: cssVar(node, "--color-ink-muted", "#9AA3B2"),
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: cssVar(node, "--color-line", "#2A313C") },
          horzLines: { color: cssVar(node, "--color-line", "#2A313C") },
        },
        rightPriceScale: { borderColor: cssVar(node, "--color-line", "#2A313C") },
        timeScale: {
          borderColor: cssVar(node, "--color-line", "#2A313C"),
          timeVisible: true,
          rightOffset: 8,
        },
        crosshair: { mode: charts.CrosshairMode.Normal },
        ...CHART_SCALE_OPTIONS,
        width: node.clientWidth,
        height: node.clientHeight,
      });
      chartShotRef.current = chart;
      const candleSeries = chart.addSeries(charts.CandlestickSeries, {
        upColor: "#34D399",
        downColor: "#F07167",
        borderUpColor: "#34D399",
        borderDownColor: "#F07167",
        wickUpColor: "#34D399",
        wickDownColor: "#F07167",
        autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
          const logical = chart.timeScale().getVisibleLogicalRange();
          const shown = candlesRef.current;
          if (!logical) {
            return original();
          }
          const plots = seriesRef.current.layers
            .filter((layer) => layer.pane === "price")
            .flatMap((layer) => layer.price.map((plot) => plot.values));
          const priceRange = visiblePriceBounds(shown, plots, logical.from, logical.to);
          if (!priceRange) {
            return original();
          }
          return { priceRange, margins: original()?.margins };
        },
      });
      const closeSeries = chart.addSeries(charts.LineSeries, {
        color: cssVar(node, "--color-accent", "#A78BFA"),
        lineWidth: 2,
        visible: false,
        priceLineVisible: true,
        lastValueVisible: true,
      });
      type PlotSeries = { setData: (data: unknown) => void };
      type Drawn = {
        lines: PlotSeries[];
        oscillator: {
          rsi: PlotSeries | null;
          macd: PlotSeries | null;
          signal: PlotSeries | null;
          histogram: PlotSeries | null;
        };
        priceSegment: PlotSeries | null;
        rsiSegment: PlotSeries | null;
      };
      function plotSeries(series: { setData: (data: never) => void }): PlotSeries {
        return {
          setData: (data) => {
            series.setData(data as never);
          },
        };
      }
      let drawn: Drawn[] = [];
      let paneCursor = 0;
      let indicatorApis: Array<Parameters<typeof chart.removeSeries>[0]> = [];
      const drawnIndicators = new Map<
        string,
        {
          kind: "line" | "histogram";
          defaultColor: string;
          applyOptions: (options: {
            color?: string;
            lineWidth?: 1 | 2 | 3;
            visible?: boolean;
          }) => void;
        }
      >();
      let previousLength = 0;
      let initialRange: { from: number; to: number } | null = null;

      function rememberIndicator(
        layerId: string,
        lineId: string,
        kind: "line" | "histogram",
        defaultColor: string,
        seriesApi: {
          applyOptions: (options: {
            color?: string;
            lineWidth?: 1 | 2 | 3;
            visible?: boolean;
          }) => void;
        },
      ) {
        drawnIndicators.set(`${layerId}\0${lineId}`, {
          kind,
          defaultColor,
          applyOptions: (options) => seriesApi.applyOptions(options),
        });
      }

      function mountIndicators() {
        for (const api of indicatorApis) {
          chart.removeSeries(api);
        }
        indicatorApis = [];
        while (chart.panes().length > 1) {
          chart.removePane(chart.panes().length - 1);
        }
        paneCursor = 0;
        drawn = [];
        drawnIndicators.clear();
        for (const layer of seriesRef.current.layers) {
          let pane = 0;
          if (layer.pane === "oscillator") {
            chart.addPane();
            paneCursor += 1;
            pane = paneCursor;
          }
          const lines = layer.price.map((plot) => {
            const line = chart.addSeries(
              charts.LineSeries,
              {
                color: plot.color,
                lineWidth: 2,
                priceLineVisible: false,
                lastValueVisible: false,
                ...(pane === 0 ? { autoscaleInfoProvider: () => null } : {}),
              },
              pane,
            );
            rememberIndicator(layer.id, plot.id, "line", plot.color, line);
            indicatorApis.push(line);
            return plotSeries(line);
          });
          const oscillator: Drawn["oscillator"] = {
            rsi: null,
            macd: null,
            signal: null,
            histogram: null,
          };
          const hiddenScaleLabel = {
            priceLineVisible: false,
            lastValueVisible: false,
          };
          if (layer.oscillator?.rsi) {
            const rsi = chart.addSeries(
              charts.LineSeries,
              { color: "#A78BFA", lineWidth: 2, ...hiddenScaleLabel },
              pane,
            );
            rememberIndicator(layer.id, "rsi", "line", "#A78BFA", rsi);
            indicatorApis.push(rsi);
            oscillator.rsi = plotSeries(rsi);
            for (const level of layer.oscillator.levels) {
              rsi.createPriceLine({
                price: level,
                color: "#F5B942",
                lineWidth: 1,
                lineStyle: charts.LineStyle.Dashed,
                axisLabelVisible: false,
                title: "",
              });
            }
          }
          if (layer.oscillator?.histogram) {
            const histogram = chart.addSeries(charts.HistogramSeries, hiddenScaleLabel, pane);
            rememberIndicator(layer.id, "histogram", "histogram", "#34D399", histogram);
            indicatorApis.push(histogram);
            oscillator.histogram = plotSeries(histogram);
            const macd = chart.addSeries(
              charts.LineSeries,
              { color: "#A78BFA", lineWidth: 2, ...hiddenScaleLabel },
              pane,
            );
            rememberIndicator(layer.id, "macd", "line", "#A78BFA", macd);
            indicatorApis.push(macd);
            oscillator.macd = plotSeries(macd);
            const signal = chart.addSeries(
              charts.LineSeries,
              { color: "#F5B942", lineWidth: 2, ...hiddenScaleLabel },
              pane,
            );
            rememberIndicator(layer.id, "signal", "line", "#F5B942", signal);
            indicatorApis.push(signal);
            oscillator.signal = plotSeries(signal);
          }
          let priceSegment: PlotSeries | null = null;
          let rsiSegment: PlotSeries | null = null;
          if (layer.divergence) {
            const priceLine = chart.addSeries(charts.LineSeries, {
              color: "#F5B942",
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
              autoscaleInfoProvider: () => null,
            });
            const rsiLine = chart.addSeries(
              charts.LineSeries,
              {
                color: "#F5B942",
                lineWidth: 2,
                lineStyle: charts.LineStyle.Dashed,
                priceLineVisible: false,
                lastValueVisible: false,
              },
              pane,
            );
            indicatorApis.push(priceLine, rsiLine);
            priceSegment = plotSeries(priceLine);
            rsiSegment = plotSeries(rsiLine);
          }
          drawn.push({ lines, oscillator, priceSegment, rsiSegment });
        }
      }

      function paintIndicators() {
        const shown = candlesRef.current;
        seriesRef.current.layers.forEach((layer, layerIndex) => {
          const row = drawn[layerIndex];
          if (!row) {
            return;
          }
          layer.price.forEach((plot, plotIndex) => {
            row.lines[plotIndex]?.setData(lineData(shown, plot.values));
          });
          if (layer.oscillator?.rsi && row.oscillator.rsi) {
            row.oscillator.rsi.setData(lineData(shown, layer.oscillator.rsi));
          }
          if (layer.divergence && row.priceSegment && row.rsiSegment) {
            const line = rsiDivergenceLine({
              bars: shown.map((bar) => ({
                high: bar.high,
                low: bar.low,
                close: bar.close,
              })),
              period: layer.divergence.period,
              settings: layer.divergence.settings,
            });
            const older = line ? shown[line.olderIndex] : null;
            const newer = line ? shown[line.newerIndex] : null;
            if (line && older && newer) {
              row.priceSegment.setData([
                { time: Math.floor(older.timeMs / 1000), value: line.olderPrice },
                { time: Math.floor(newer.timeMs / 1000), value: line.newerPrice },
              ]);
              row.rsiSegment.setData([
                { time: Math.floor(older.timeMs / 1000), value: line.olderRsi },
                { time: Math.floor(newer.timeMs / 1000), value: line.newerRsi },
              ]);
            } else {
              row.priceSegment.setData([]);
              row.rsiSegment.setData([]);
            }
          }
          if (layer.oscillator?.histogram && row.oscillator.histogram) {
            const histogramStyle = indicatorLineStyle(
              styleStateRef.current.session,
              styleStateRef.current.saved,
              layer.id,
              "histogram",
            );
            row.oscillator.histogram.setData(
              lineData(shown, layer.oscillator.histogram).map((point) => {
                const value = point.value ?? 0;
                const sign = value >= 0 ? "#34D399" : "#F07167";
                return {
                  ...point,
                  color: styledLineColor(node, histogramStyle, sign),
                };
              }),
            );
            row.oscillator.macd?.setData(lineData(shown, layer.oscillator.macd ?? []));
            row.oscillator.signal?.setData(lineData(shown, layer.oscillator.signal ?? []));
          }
        });
      }

      function paint(resetView: boolean) {
        const shown = candlesRef.current;
        if (shown.length === 0) {
          return;
        }
        const range = chart.timeScale().getVisibleLogicalRange();
        const bars = shown.map((row) => ({
          time: Math.floor(row.timeMs / 1000) as never,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
        }));
        candleSeries.setData(bars);
        closeSeries.setData(bars.map((row) => ({ time: row.time, value: row.close })));
        const lineMode = chartAppearanceRef.current.series === "line";
        candleSeries.applyOptions({ visible: !lineMode });
        closeSeries.applyOptions({ visible: lineMode });
        paintIndicators();
        const end = shown.length - 1;
        if (resetView || !range) {
          const next = { from: end - 120, to: end + 8 };
          chart.timeScale().setVisibleLogicalRange(next);
          initialRange = next;
        } else if (previousLength > 0 && range.to >= previousLength - 3) {
          const shift = shown.length - previousLength;
          chart.timeScale().setVisibleLogicalRange({
            from: range.from + shift,
            to: range.to + shift,
          });
        } else {
          chart.timeScale().setVisibleLogicalRange(range);
        }
        previousLength = shown.length;
      }

      function applyIndicatorStyles() {
        const { session, saved } = styleStateRef.current;
        for (const [key, row] of drawnIndicators) {
          const split = key.indexOf("\0");
          const layerId = key.slice(0, split);
          const lineId = key.slice(split + 1);
          const style = indicatorLineStyle(session, saved, layerId, lineId);
          if (row.kind === "histogram") {
            row.applyOptions({ visible: style.visible });
            continue;
          }
          row.applyOptions({
            color: styledLineColor(node, style, row.defaultColor),
            lineWidth: style.lineWidth,
            visible: style.visible,
          });
        }
      }

      function applyAppearance() {
        const look = chartAppearanceRef.current;
        const background = appearanceColor(
          node,
          look.background,
          "--color-canvas",
          "#0B0E14",
          look.backgroundOpacity,
        );
        const grid = replayGridPaint(
          appearanceColor(node, look.grid, "--color-line", "#2A313C"),
          look.gridOpacity,
        );
        const up = appearanceColor(node, look.up, "--color-success", "#34D399", look.upOpacity);
        const down = appearanceColor(node, look.down, "--color-danger", "#F07167", look.downOpacity);
        chart.applyOptions({
          layout: {
            background: { type: charts.ColorType.Solid, color: background },
          },
          grid: {
            vertLines: grid,
            horzLines: grid,
          },
        });
        candleSeries.applyOptions({
          upColor: up,
          downColor: down,
          borderUpColor: up,
          borderDownColor: down,
          wickUpColor: up,
          wickDownColor: down,
          visible: look.series !== "line",
        });
        closeSeries.applyOptions({
          visible: look.series === "line",
          color: cssVar(node, "--color-accent", "#A78BFA"),
        });
        paint(false);
      }

      function sizeOscillatorPanes() {
        const panes = chart.panes();
        const weights = oscillatorPaneStretch(node.clientHeight, panes.length - 1);
        if (!weights) {
          return;
        }
        panes[0]?.setStretchFactor(weights.price);
        for (let index = 1; index < panes.length; index += 1) {
          panes[index]?.setStretchFactor(weights.oscillator);
        }
      }

      function publishOscillatorTops() {
        const hostTop = node.getBoundingClientRect().top;
        const tops = chart
          .panes()
          .slice(1)
          .flatMap((pane) => {
            const element = pane.getHTMLElement();
            if (!element) {
              return [];
            }
            return [Math.round(element.getBoundingClientRect().top - hostTop)];
          });
        setOscillatorTops((current) =>
          current.length === tops.length && current.every((value, index) => value === tops[index])
            ? current
            : tops,
        );
      }

      function resetPriceScales() {
        for (const pane of chart.panes()) {
          pane.priceScale("right").setAutoScale(true);
        }
      }

      mountIndicators();
      applyAppearanceRef.current = applyAppearance;
      applyIndicatorStylesRef.current = () => {
        applyIndicatorStyles();
        paintIndicators();
      };
      paintRef.current = (resetView) => paint(resetView);
      resetChartRef.current = () => {
        if (initialRange) {
          chart.timeScale().setVisibleLogicalRange(initialRange);
        }
        resetPriceScales();
      };
      resetPriceRef.current = resetPriceScales;
      syncIndicatorsRef.current = () => {
        if (disposed) {
          return;
        }
        mountIndicators();
        applyIndicatorStyles();
        paint(false);
        sizeOscillatorPanes();
        publishOscillatorTops();
        const nextIds = referencesRef.current;
        setAppliedReferences((current) =>
          sameReferenceIds(current, nextIds) ? current : [...nextIds],
        );
      };
      applyAppearance();
      applyIndicatorStyles();
      paint(true);
      sizeOscillatorPanes();
      publishOscillatorTops();
      const nextIds = referencesRef.current;
      setAppliedReferences((current) =>
        sameReferenceIds(current, nextIds) ? current : [...nextIds],
      );
      chart.subscribeCrosshairMove((param) => {
        const time = typeof param.time === "number" ? param.time : null;
        if (!param.point || time == null) {
          setLegendIndex(null);
          return;
        }
        const shown = candlesRef.current;
        const barIndex = shown.findIndex((row) => Math.floor(row.timeMs / 1000) === time);
        setLegendIndex(barIndex >= 0 ? barIndex : null);
      });
      const observer = new ResizeObserver(() => {
        chart.applyOptions({ width: node.clientWidth, height: node.clientHeight });
        sizeOscillatorPanes();
        publishOscillatorTops();
      });
      observer.observe(node);
      const detachAxisWheel = attachRightAxisWheel(node, () => chart);
      cleanup = () => {
        detachAxisWheel();
        observer.disconnect();
        chart.remove();
        chartShotRef.current = null;
        paintRef.current = null;
        syncIndicatorsRef.current = null;
        applyAppearanceRef.current = null;
        applyIndicatorStylesRef.current = null;
        resetChartRef.current = null;
        resetPriceRef.current = null;
      };
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [chartKey, ready]);

  useEffect(() => {
    paintRef.current?.(false);
  }, [candles]);

  const layerKey = series.layers
    .map((layer) => `${layer.id}:${layer.inputs.map((field) => field.value).join(",")}`)
    .join("|");
  useEffect(() => {
    const sync = syncIndicatorsRef.current;
    if (sync) {
      sync();
      return;
    }
    setAppliedReferences((current) =>
      sameReferenceIds(current, references) ? current : [...references],
    );
  }, [layerKey, references]);

  const appearanceKey = serializeReplayChartAppearance(chartAppearance);
  useEffect(() => {
    applyAppearanceRef.current?.();
  }, [appearanceKey]);

  useEffect(() => {
    applyIndicatorStylesRef.current?.();
  }, [savedStyles, sessionStyles]);

  const fillViewport = expanded || monitorFull;
  const showSpinner = !matched;
  const trialLine = researchGate ? researchTrialLine(researchGate.indicators) : null;

  return (
    <section
      ref={frameRef}
      className={
        fillViewport
          ? "desk-chart-frame fixed inset-0 z-50 flex h-dvh w-full flex-col bg-canvas"
          : "desk-chart-frame flex h-[28rem] min-w-0 flex-col overflow-hidden rounded-card border border-line bg-canvas @min-[960px]:h-[40rem]"
      }
    >
      <ClickGateNotice
        access={indicatorGate.notice}
        anchorRef={indicatorGate.anchorRef}
        generation={indicatorGate.generation}
        onDismiss={indicatorGate.hide}
      />
      <ReplayChartBar
        interval={interval}
        onInterval={(value) => commitDeskChart({ ...view, interval: value })}
        favoriteIntervals={favoriteIntervals}
        onFavoriteIntervals={(value) =>
          commitDeskChart({ ...view, favoriteIntervals: value })
        }
        appearance={chartAppearance}
        onChange={(patch) => {
          setSessionAppearance((current) => patchReplayChartAppearance(current, patch));
        }}
        onSave={(fields) => {
          const patch = pickReplayChartFields(sessionAppearance, fields);
          setSessionAppearance((current) => clearReplayChartFields(current, fields));
          commitDeskChart({
            ...view,
            chartAppearance: saveReplayChartAppearance(view.chartAppearance, patch),
          });
        }}
        onReset={(fields) => {
          setSessionAppearance((current) => clearReplayChartFields(current, fields));
          commitDeskChart({
            ...view,
            chartAppearance:
              resetReplayChartFields(view.chartAppearance, fields) ??
              defaultReplayChartAppearance(),
          });
        }}
        getChart={() => chartShotRef.current}
        screenshotName={`${symbol || "chart"}.png`}
        indicators={indicatorChoices}
        references={references}
        appliedReferences={appliedReferences}
        indicatorsIntro="Turn any indicator on. It draws on this chart."
        leading={
          <span className="px-1 text-sm font-semibold text-ink">{symbol}</span>
        }
        trailing={
          <>
            {monitorFull ? null : (
              <button
                type="button"
                title={expanded ? "Exit browser fill" : "Fill browser"}
                aria-label={expanded ? "Exit browser fill" : "Fill browser"}
                className={TOOL_BUTTON}
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? <IconCollapse {...FRAME_ICON} /> : <IconExpand {...FRAME_ICON} />}
              </button>
            )}
            <button
              type="button"
              title={monitorFull ? "Exit full screen" : "Full screen"}
              aria-label={monitorFull ? "Exit full screen" : "Full screen"}
              className={TOOL_BUTTON}
              onClick={() => {
                const node = frameRef.current;
                if (!node) {
                  return;
                }
                if (monitorFullscreenElement() === node) {
                  void exitMonitorFullscreen();
                  return;
                }
                setMonitorFull(true);
                window.requestAnimationFrame(() => {
                  const next = frameRef.current;
                  if (!next) {
                    setMonitorFull(false);
                    return;
                  }
                  void requestMonitorFullscreen(next).catch(() => {
                    setMonitorFull(false);
                  });
                });
              }}
            >
              {monitorFull ? (
                <IconExitMonitor {...FRAME_ICON} />
              ) : (
                <IconMonitor {...FRAME_ICON} />
              )}
            </button>
          </>
        }
        indicatorNotice={
          <ResearchTrialLines lines={trialLine ? [trialLine] : []} />
        }
        onToggleReference={(id, enabled, anchor) => {
          if (enabled) {
            const denial = researchGate ? indicatorAddDenial(researchGate) : null;
            if (denial) {
              indicatorGate.show(denial, anchor);
              return;
            }
          }
          indicatorGate.hide();
          commitDeskChart({
            ...view,
            referenceIndicators: enabled
              ? references.includes(id)
                ? references
                : [...references, id]
              : references.filter((row) => row !== id),
          });
        }}
      />
      <div className="relative min-h-0 flex-1">
        <div
          ref={hostRef}
          className="absolute inset-0"
          onContextMenu={(event) => {
            event.preventDefault();
            setChartMenu({ x: event.clientX, y: event.clientY });
          }}
        />
        {showSpinner ? (
          <div
            className="absolute inset-0 flex items-center justify-center bg-canvas/70"
            role="status"
            aria-label="Loading candles"
          >
            <IconLoader className="size-10 animate-spin text-accent" />
          </div>
        ) : null}
        {!showSpinner && candles.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-ink-muted">
            {error ?? "No candles for this contract."}
          </div>
        ) : null}
        {legendRows.length > 0 && candles.length > 0 ? (
          <ReplayIndicatorLegend
            rows={legendRows}
            targets={styleTargets}
            names={styleNames}
            inputs={indicatorInputs.fields}
            inputsLocked={indicatorInputs.locked}
            timeframes={indicatorInputs.timeframes}
            session={sessionStyles}
            saved={savedStyles}
            paneTops={oscillatorTops}
            onChange={(layerId, lineId, style) => {
              setSessionStyles((current) => writeIndicatorLineStyle(current, layerId, lineId, style));
            }}
            onSaveGlobal={(layerId) => {
              commitDeskChart({
                ...view,
                indicatorStyles: saveIndicatorStyleGlobal(
                  view.indicatorStyles,
                  sessionStyles,
                  layerId,
                ),
              });
              setSessionStyles((current) => resetIndicatorStyle(current, layerId));
            }}
            onReset={(layerId) => {
              setSessionStyles((current) => resetIndicatorStyle(current, layerId));
              commitDeskChart({
                ...view,
                indicatorStyles: resetIndicatorStyle(view.indicatorStyles, layerId),
              });
            }}
            onInput={(layerId, inputId, value) => {
              if (!layerId.startsWith("ref:")) {
                return;
              }
              const kind = layerId.slice(4) as keyof ReplayReferenceInputs;
              commitDeskChart({
                ...view,
                referenceInputs: {
                  ...view.referenceInputs,
                  [kind]: { ...view.referenceInputs[kind], [inputId]: value },
                },
              });
            }}
          />
        ) : null}
        <ChartContextMenu
          menu={chartMenu}
          onClose={() => setChartMenu(null)}
          onResetChart={() => resetChartRef.current?.()}
          onResetPrice={() => resetPriceRef.current?.()}
        />
      </div>
    </section>
  );
}
