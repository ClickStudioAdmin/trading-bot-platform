"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { AutoscaleInfo } from "lightweight-charts";
import {
  indicatorRolesForReason,
  indicatorStyleTargets,
  oscillatorPaneStretch,
  visiblePriceBounds,
  replayChartSeries,
  replayIndicatorCatalog,
  replayIndicatorLegend,
  type IndicatorInput,
  type IndicatorStyleTarget,
  type ReplayReferenceInputs,
} from "@/lib/backtest/chart-series";
import {
  REPLAY_INDICATOR_STYLE_KEY,
  indicatorLineStyle,
  parseIndicatorStyles,
  resetIndicatorStyle,
  saveIndicatorStyleGlobal,
  serializeIndicatorStyles,
  writeIndicatorLineStyle,
  type IndicatorLineStyle,
  type IndicatorStyleMap,
} from "@/lib/backtest/indicator-style";
import {
  ChartContextMenu,
  type ChartContextMenuState,
} from "@/components/chart-context-menu";
import { ReplayIndicatorLegend } from "@/components/replay-indicator-legend";
import { ReplayChartBar } from "@/components/replay-chart-bar";
import type { ChartSnapshot } from "@/components/chart-screenshot";
import {
  REPLAY_CHART_APPEARANCE_KEY,
  mergeReplayChartAppearance,
  parseReplayChartAppearance,
  patchReplayChartAppearance,
  clearReplayChartFields,
  colorWithOpacity,
  pickReplayChartFields,
  replayGridPaint,
  resetReplayChartFields,
  saveReplayChartAppearance,
  serializeReplayChartAppearance,
  type ReplayChartAppearance,
  type ReplayChartAppearancePatch,
} from "@/lib/backtest/chart-appearance";
import { eventParameterSections } from "@/lib/backtest/event-pane";
import {
  coalesceReplayPositions,
  fitLaneCaption,
  groupReplayEventsByPosition,
  placeLaneCaption,
  replayEventLabelWidth,
  replayLaneLabelWidth,
  separateLaneLabels,
  replayLaneStillOpen,
  replayMarkerInPositionFocus,
  replayPositionVisibleRange,
  type ReplayEventGroup,
  type ReplayLaneLabelBox,
} from "@/lib/backtest/event-groups";
import { eventForOrder, eventsFromOrders } from "@/lib/backtest/events";
import {
  eventsThrough,
  nextEventIndex,
  ordersThrough,
  previousEventIndex,
  replayPlayStats,
} from "@/lib/backtest/play";
import {
  backtestChartFetchBounds,
  type BacktestRun,
  type ReplayEvent,
  type SimulatedOrder,
} from "@/lib/backtest/model";
import { listBacktestCycles } from "@/lib/backtest/positions";
import {
  DCA_INDICATOR_TIMEFRAME_LABELS,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import { attachRightAxisWheel } from "@/lib/charts/interact";
import { loadBacktestDisplayCandles } from "@/lib/charts/load-backtest-candles";
import { clipCandlesToWindow, type CandleBar } from "@/lib/market/candles";
import { formatPrice, formatQty, signedTone } from "@/lib/opportunities/format";
import {
  IconChevronRight,
  IconClose,
  IconCollapse,
  IconExitMonitor,
  IconExpand,
  IconLoader,
  IconMonitor,
  IconPageLayout,
  IconPause,
  IconPlay,
  IconSkipBack,
  IconSkipForward,
  IconStepBack,
  IconStepForward,
} from "@/components/icons";
import { Modal } from "@/components/template-modals";
import { SortTh, TableCard, TablePager, useClientTable } from "@/components/table-chrome";
import { compareTableNum, compareTableText, type TableSortDir } from "@/lib/table-chrome";
import type { BacktestPositionCycle } from "@/lib/backtest/positions";

const SPEEDS = [1, 2, 4, 8] as const;
const EMPTY_CANDLES: CandleBar[] = [];
const FRAME_ICON = { size: 16, className: "size-4" } as const;

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
  const request =
    el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
  if (!request) {
    return Promise.reject(new Error("Fullscreen is not available."));
  }
  return request();
}

function exitMonitorFullscreen() {
  const doc = document as WebkitFullscreenDocument;
  const exit =
    document.exitFullscreen?.bind(document) ?? doc.webkitExitFullscreen?.bind(doc);
  if (!exit) {
    return Promise.resolve();
  }
  return exit();
}

function money(value: number): string {
  const abs = Math.abs(value);
  const text = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `−$${text}` : `$${text}`;
}

function readStoredChartAppearance(): ReplayChartAppearance | null {
  try {
    return parseReplayChartAppearance(
      window.localStorage.getItem(REPLAY_CHART_APPEARANCE_KEY),
    );
  } catch {
    return null;
  }
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

function readStoredIndicatorStyles(): IndicatorStyleMap {
  try {
    return parseIndicatorStyles(
      window.localStorage.getItem(REPLAY_INDICATOR_STYLE_KEY),
    );
  } catch {
    return {};
  }
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

function candleIndexAt(candles: CandleBar[], atMs: number): number {
  let index = 0;
  for (let i = 0; i < candles.length; i += 1) {
    if ((candles[i]?.timeMs ?? 0) <= atMs) {
      index = i;
    } else {
      break;
    }
  }
  return index;
}

function sameReferenceIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const seen = new Set(left);
  return right.every((id) => seen.has(id));
}

function lineData(
  candles: CandleBar[],
  values: (number | null)[],
  through: number,
) {
  const rows: Array<{ time: number; value?: number }> = [];
  let started = false;
  for (let i = 0; i <= through && i < candles.length; i += 1) {
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

export function ReplayPlayer({ run }: { run: BacktestRun }) {
  const events = useMemo(
    () => run.replayEvents ?? eventsFromOrders(run.orders),
    [run.replayEvents, run.orders],
  );
  const [interval, setInterval] = useState<DcaIndicatorTimeframe>(run.interval);
  const [load, setLoad] = useState<{
    key: string;
    candles: CandleBar[];
    error: string | null;
  }>({ key: "", candles: [], error: null });
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const [openOrderKey, setOpenOrderKey] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ReplayEvent | null>(null);
  const selectedRef = useRef<ReplayEvent | null>(null);
  selectedRef.current = selectedEvent;
  const [positionFocus, setPositionFocus] = useState<ChartPositionFocus | null>(
    null,
  );
  const [legendIndex, setLegendIndex] = useState<number | null>(null);
  const [sessionStyles, setSessionStyles] = useState<IndicatorStyleMap>({});
  const [globalStyles, setGlobalStyles] = useState<IndicatorStyleMap | null>(null);
  if (globalStyles === null && typeof window !== "undefined") {
    setGlobalStyles(readStoredIndicatorStyles());
  }
  const savedStyles = globalStyles ?? {};
  const [sessionAppearance, setSessionAppearance] = useState<ReplayChartAppearancePatch>({});
  const [savedAppearance, setSavedAppearance] = useState<ReplayChartAppearance | null | undefined>(
    undefined,
  );
  if (savedAppearance === undefined && typeof window !== "undefined") {
    setSavedAppearance(readStoredChartAppearance());
  }
  const chartAppearance = mergeReplayChartAppearance(
    savedAppearance ?? null,
    sessionAppearance,
  );
  const chartAppearanceRef = useRef(chartAppearance);
  chartAppearanceRef.current = chartAppearance;
  const chartShotRef = useRef<ChartSnapshot | null>(null);
  const applyAppearanceRef = useRef<(() => void) | null>(null);
  const indicatorStyleStateRef = useRef({
    session: {} as IndicatorStyleMap,
    saved: {} as IndicatorStyleMap,
  });
  indicatorStyleStateRef.current = {
    session: sessionStyles,
    saved: savedStyles,
  };
  const drawnIndicatorsRef = useRef<
    Map<
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
    >
  >(new Map());
  const applyIndicatorStylesRef = useRef<(() => void) | null>(null);
  const positionFocusRef = useRef<ChartPositionFocus | null>(null);
  positionFocusRef.current = positionFocus;
  const cycleById = useMemo(() => {
    const cycles = listBacktestCycles(run.orders);
    return new Map(cycles.map((cycle) => [cycle.id, cycle]));
  }, [run.orders]);
  const ordersRef = useRef(run.orders);
  ordersRef.current = run.orders;
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(
    null,
  );
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [oscillatorTops, setOscillatorTops] = useState<number[]>([]);
  const resetChartRef = useRef<(() => void) | null>(null);
  const resetPriceRef = useRef<(() => void) | null>(null);
  const [chartMenu, setChartMenu] = useState<ChartContextMenuState>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef(0);
  const focusRef = useRef<number | null>(null);
  const focusSpanRef = useRef<{ from: number; to: number } | null>(null);
  const [playback, setPlayback] = useState({ key: "", started: false });
  const [expanded, setExpanded] = useState(false);
  const [monitorFull, setMonitorFull] = useState(false);
  const [positionsRight, setPositionsRight] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [sideLanes, setSideLanes] = useState(false);
  const [laneFrame, setLaneFrame] = useState(0);
  const [placedLanes, setPlacedLanes] = useState<ReplayLaneDraw[]>([]);
  const sideLanesRef = useRef(false);
  const laneSyncRef = useRef<() => void>(() => {});
  const laneTrackRef = useRef<HTMLDivElement | null>(null);
  sideLanesRef.current = sideLanes;
  laneSyncRef.current = () => {
    if (sideLanesRef.current) {
      setLaneFrame((frame) => frame + 1);
    }
  };
  const loadKey = `${run.id}:${interval}`;
  const candles = load.key === loadKey ? load.candles : EMPTY_CANDLES
  const loading = load.key !== loadKey;
  const error = load.key === loadKey ? load.error : null;
  const candleKey = `${loadKey}:${candles.length}:${candles[0]?.timeMs ?? 0}`;
  const startHead = 0;
  const [cursor, setCursor] = useState({ key: "", head: 0, playing: false });
  if (cursor.key !== candleKey) {
    setCursor({ key: candleKey, head: startHead, playing: false });
  }
  const head = cursor.key === candleKey ? cursor.head : startHead;
  const playing = cursor.key === candleKey ? cursor.playing : false;
  if (playback.key !== candleKey) {
    setPlayback({ key: candleKey, started: false });
  }
  const started = playback.key === candleKey ? playback.started : false;
  headRef.current = head;
  const fillViewport = expanded || monitorFull;

  function revealChart() {
    setPlayback({ key: candleKey, started: true });
  }

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
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded, monitorFull]);

  function beginPlayback() {
    revealChart();
    setCursor((current) => ({ ...current, playing: true, head: 0 }));
  }

  useEffect(() => {
    let cancelled = false;
    const bounds = backtestChartFetchBounds(run, interval);
    const key = `${run.id}:${interval}`;
    void loadBacktestDisplayCandles({
      venue: run.venue,
      venueEnvironment: run.venueEnvironment,
      symbol: run.symbol,
      interval,
      fromMs: bounds.fromMs,
      toMs: bounds.toMs,
    })
      .then((rows) => {
        if (!cancelled) {
          setLoad({
            key,
            candles: clipCandlesToWindow(rows, bounds.fromMs, bounds.toMs),
            error: null,
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoad({
            key,
            candles: [],
            error: err instanceof Error ? err.message : "Could not read candles.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [run, interval]);

  useEffect(() => {
    if (!playing || candles.length === 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setCursor((current) => {
        if (current.head >= candles.length - 1) {
          return { ...current, playing: false };
        }
        return {
          ...current,
          head: Math.min(candles.length - 1, current.head + speed),
        };
      });
    }, 280);
    return () => window.clearInterval(timer);
  }, [playing, speed, candles.length]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        if (!started) {
          beginPlayback();
          return;
        }
        setCursor((current) => ({ ...current, playing: !current.playing }));
      } else if (event.key === "ArrowRight" && event.shiftKey) {
        event.preventDefault();
        revealChart();
        jumpEvent(1);
      } else if (event.key === "ArrowLeft" && event.shiftKey) {
        event.preventDefault();
        revealChart();
        jumpEvent(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        revealChart();
        setCursor((current) => ({
          ...current,
          playing: false,
          head: Math.min(candles.length - 1, current.head + 1),
        }));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        revealChart();
        setCursor((current) => ({
          ...current,
          playing: false,
          head: Math.max(0, current.head - 1),
        }));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const throughMs = candles[head]?.timeMs ?? run.fromMs;
  const visibleOrders = ordersThrough(run.orders, throughMs);
  const visibleEvents = eventsThrough(events, throughMs);
  const eventGroups = useMemo(
    () => groupReplayEventsByPosition(visibleEvents, run.orders),
    [visibleEvents, run.orders],
  );
  const eventStripRef = useRef<HTMLDivElement | null>(null);
  const lanePanRef = useRef<{ x: number; from: number; to: number } | null>(null);
  useEffect(() => {
    const root = eventStripRef.current;
    if (!root) {
      return;
    }
    const strips = root.matches("[data-event-strip]")
      ? [root]
      : [...root.querySelectorAll<HTMLElement>("[data-event-strip]")];
    for (const node of strips) {
      node.scrollLeft = node.scrollWidth;
    }
  }, [visibleEvents.length, sideLanes]);
  const stats = replayPlayStats(visibleOrders, run.startingUsdt);
  const [references, setReferences] = useState<string[]>([]);
  const deferredReferences = useDeferredValue(references);
  const [appliedReferences, setAppliedReferences] = useState<string[]>([]);
  const [referenceInputs, setReferenceInputs] = useState<ReplayReferenceInputs>({});
  const series = useMemo(
    () => replayChartSeries(run.recipe, candles, deferredReferences, referenceInputs),
    [run.recipe, candles, deferredReferences, referenceInputs],
  );
  const indicatorChoices = useMemo(
    () => replayIndicatorCatalog(run.recipe),
    [run.recipe],
  );
  const legendRows = useMemo(
    () => replayIndicatorLegend(series.layers, legendIndex ?? head),
    [series.layers, legendIndex, head],
  );
  const styleTargets = useMemo(() => {
    const targets: Record<string, IndicatorStyleTarget[]> = {};
    for (const layer of series.layers) {
      targets[layer.id] = indicatorStyleTargets(layer);
    }
    return targets;
  }, [series.layers]);
  const styleNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const layer of series.layers) {
      names[layer.id] = layer.title;
    }
    return names;
  }, [series.layers]);
  const indicatorInputs = useMemo(() => {
    const fields: Record<string, IndicatorInput[]> = {};
    const locked: Record<string, boolean> = {};
    const timeframes: Record<string, string> = {};
    for (const layer of series.layers) {
      fields[layer.id] = layer.inputs;
      locked[layer.id] = layer.inputsLocked;
      timeframes[layer.id] = layer.timeframeLabel;
    }
    return { fields, locked, timeframes };
  }, [series.layers]);
  useEffect(() => {
    if (globalStyles === null) {
      return;
    }
    window.localStorage.setItem(
      REPLAY_INDICATOR_STYLE_KEY,
      serializeIndicatorStyles(globalStyles),
    );
  }, [globalStyles]);
  const chartLabel = DCA_INDICATOR_TIMEFRAME_LABELS[interval];
  const otherTimeframes = series.layers
    .map((layer) =>
      layer.timeframe ? DCA_INDICATOR_TIMEFRAME_LABELS[layer.timeframe] : "",
    )
    .filter((label) => label && label !== chartLabel);
  const timeframeNote =
    otherTimeframes.length > 0
      ? `Conditions on ${Array.from(new Set(otherTimeframes)).join(", ")} are drawn on these ${chartLabel} candles.`
      : null;

  function jumpEvent(direction: 1 | -1) {
    if (candles.length === 0) {
      return;
    }
    const index =
      direction > 0
        ? nextEventIndex(events, throughMs)
        : previousEventIndex(events, throughMs);
    const event = index >= 0 ? events[index] : null;
    if (!event) {
      return;
    }
    revealChart();
    setCursor((current) => ({
      ...current,
      playing: false,
      head: candleIndexAt(candles, event.atMs),
    }));
  }

  function focusSpan(fromMs: number, toMs: number) {
    if (candles.length === 0) {
      return;
    }
    const from = candleIndexAt(candles, Math.min(fromMs, toMs));
    const to = candleIndexAt(candles, Math.max(fromMs, toMs));
    focusRef.current = null;
    focusSpanRef.current = { from, to };
    const host = hostRef.current as
      | (HTMLDivElement & { __focusRange?: (from: number, to: number) => void })
      | null;
    host?.__focusRange?.(from, to);
  }

  function viewPosition(
    fromMs: number,
    toMs: number,
    focus: { number: number; orders: readonly SimulatedOrder[] } | null,
  ) {
    revealChart();
    setCursor((current) => ({ ...current, playing: false }));
    focusSpan(fromMs, toMs);
    if (!focus) {
      return;
    }
    const orders = new Set<number>();
    for (const order of focus.orders) {
      const index = run.orders.indexOf(order);
      if (index >= 0) {
        orders.add(index);
      }
    }
    if (orders.size > 0) {
      setPositionFocus({ number: focus.number, orders });
    }
  }

  function showPosition(hit: PositionHit) {
    const cycle = cycleById.get(hit.id);
    viewPosition(
      hit.fromMs,
      hit.toMs,
      hit.number != null && cycle
        ? { number: hit.number, orders: cycle.orders }
        : null,
    );
  }

  function showEvent(event: ReplayEvent) {
    if (
      positionFocus &&
      (event.orderIndex == null || !positionFocus.orders.has(event.orderIndex))
    ) {
      setPositionFocus(null);
    }
    if (selectedEvent === event) {
      setSelectedEvent(null);
      return;
    }
    setSelectedEvent(event);
    setCursor((current) => ({ ...current, playing: false }));
  }

  function onLanePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    if (event.target instanceof Element && event.target.closest("button")) {
      return;
    }
    const host = hostRef.current as
      | (HTMLDivElement & {
          __pan?: (
            dx: number,
            origin: { from: number; to: number } | null,
          ) => { from: number; to: number } | null;
        })
      | null;
    const origin = host?.__pan?.(0, null);
    if (!origin) {
      return;
    }
    lanePanRef.current = { x: event.clientX, from: origin.from, to: origin.to };
    event.currentTarget.setPointerCapture(event.pointerId);
    setCursor((current) => ({ ...current, playing: false }));
  }

  function onLanePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const pan = lanePanRef.current;
    if (!pan) {
      return;
    }
    const host = hostRef.current as
      | (HTMLDivElement & {
          __pan?: (
            dx: number,
            origin: { from: number; to: number } | null,
          ) => { from: number; to: number } | null;
        })
      | null;
    host?.__pan?.(event.clientX - pan.x, pan);
  }

  function onLanePointerUp() {
    lanePanRef.current = null;
  }

  function showTrade(cycle: BacktestPositionCycle & { tradeNumber: number }) {
    if (cycle.orders.length === 0) {
      return;
    }
    viewPosition(cycle.openedAtMs, cycle.closedAtMs ?? throughMs, {
      number: cycle.tradeNumber,
      orders: cycle.orders,
    });
  }

  useEffect(() => {
    const paintedReferences = deferredReferences;
    const host = hostRef.current;
    if (!started || !host || candles.length === 0) {
      setAppliedReferences((current) =>
        sameReferenceIds(current, paintedReferences) ? current : paintedReferences,
      );
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
          if (!logical) {
            return original();
          }
          const plots = series.layers
            .filter((layer) => layer.pane === "price")
            .flatMap((layer) => layer.price.map((plot) => plot.values));
          const priceRange = visiblePriceBounds(candles, plots, logical.from, logical.to);
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
      const drawn: Array<{
        lines: ReturnType<typeof chart.addSeries>[];
        dots: ReturnType<typeof chart.addSeries>;
        oscillator: {
          rsi: ReturnType<typeof chart.addSeries> | null;
          macd: ReturnType<typeof chart.addSeries> | null;
          signal: ReturnType<typeof chart.addSeries> | null;
          histogram: ReturnType<typeof chart.addSeries> | null;
        };
      }> = [];
      let paneCursor = 0;
      const drawnIndicators = drawnIndicatorsRef.current;
      drawnIndicators.clear();
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
      for (const layer of series.layers) {
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
          return line;
        });
        const oscillator = {
          rsi: null as ReturnType<typeof chart.addSeries> | null,
          macd: null as ReturnType<typeof chart.addSeries> | null,
          signal: null as ReturnType<typeof chart.addSeries> | null,
          histogram: null as ReturnType<typeof chart.addSeries> | null,
        };
        const hiddenScaleLabel = {
          priceLineVisible: false,
          lastValueVisible: false,
        };
        if (layer.oscillator?.rsi) {
          oscillator.rsi = chart.addSeries(
            charts.LineSeries,
            {
              color: "#A78BFA",
              lineWidth: 2,
              ...hiddenScaleLabel,
            },
            pane,
          );
          rememberIndicator(layer.id, "rsi", "line", "#A78BFA", oscillator.rsi);
          for (const level of layer.oscillator.levels) {
            oscillator.rsi.createPriceLine({
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
          oscillator.histogram = chart.addSeries(
            charts.HistogramSeries,
            hiddenScaleLabel,
            pane,
          );
          rememberIndicator(
            layer.id,
            "histogram",
            "histogram",
            "#34D399",
            oscillator.histogram,
          );
          oscillator.macd = chart.addSeries(
            charts.LineSeries,
            {
              color: "#A78BFA",
              lineWidth: 2,
              ...hiddenScaleLabel,
            },
            pane,
          );
          rememberIndicator(layer.id, "macd", "line", "#A78BFA", oscillator.macd);
          oscillator.signal = chart.addSeries(
            charts.LineSeries,
            {
              color: "#F5B942",
              lineWidth: 2,
              ...hiddenScaleLabel,
            },
            pane,
          );
          rememberIndicator(layer.id, "signal", "line", "#F5B942", oscillator.signal);
        }
        const dots = chart.addSeries(
          charts.LineSeries,
          {
            color: "#F5B942",
            lineVisible: false,
            pointMarkersVisible: true,
            pointMarkersRadius: 4,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
            ...(pane === 0 ? { autoscaleInfoProvider: () => null } : {}),
          },
          pane,
        );
        drawn.push({ lines, dots, oscillator });
      }
      let initialRange: { from: number; to: number } | null = null;
      function resetPriceScales() {
        for (const pane of chart.panes()) {
          pane.priceScale("right").setAutoScale(true);
        }
      }
      resetChartRef.current = () => {
        if (initialRange) {
          chart.timeScale().setVisibleLogicalRange(initialRange);
        }
        resetPriceScales();
      };
      resetPriceRef.current = resetPriceScales;
      const markers = charts.createSeriesMarkers(candleSeries, []);
      const lineMarkers = charts.createSeriesMarkers(closeSeries, []);
      function paint(index: number, follow = true) {
        const end = Math.max(0, Math.min(index, candles.length - 1));
        const shown = candles.slice(0, end + 1);
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
        const at = candles[end]?.timeMs ?? 0;
        const focusOrders = positionFocusRef.current?.orders ?? null;
        series.layers.forEach((layer, layerIndex) => {
          const row = drawn[layerIndex];
          if (!row) {
            return;
          }
          layer.price.forEach((plot, plotIndex) => {
            row.lines[plotIndex]?.setData(
              lineData(candles, plot.values, end) as never,
            );
          });
          if (layer.oscillator?.rsi && row.oscillator.rsi) {
            row.oscillator.rsi.setData(
              lineData(candles, layer.oscillator.rsi, end) as never,
            );
          }
          if (layer.oscillator?.histogram && row.oscillator.histogram) {
            const histogramStyle = indicatorLineStyle(
              indicatorStyleStateRef.current.session,
              indicatorStyleStateRef.current.saved,
              layer.id,
              "histogram",
            );
            row.oscillator.histogram.setData(
              lineData(candles, layer.oscillator.histogram, end).map((point) => {
                const value = point.value ?? 0;
                const sign = value >= 0 ? "#34D399" : "#F07167";
                return {
                  ...point,
                  color: styledLineColor(node, histogramStyle, sign),
                };
              }) as never,
            );
            row.oscillator.macd?.setData(
              lineData(candles, layer.oscillator.macd ?? [], end) as never,
            );
            row.oscillator.signal?.setData(
              lineData(candles, layer.oscillator.signal ?? [], end) as never,
            );
          }
          const dots: Array<{ time: number; value: number }> = [];
          const seen = new Set<number>();
          const rolesPresent = series.layers.flatMap((row) => row.roles);
          for (const item of events) {
            if (item.atMs > at) {
              continue;
            }
            const roles = indicatorRolesForReason(item.reason, item.side, rolesPresent);
            if (!roles.some((role) => layer.roles.includes(role))) {
              continue;
            }
            if (!replayMarkerInPositionFocus(item.orderIndex, focusOrders)) {
              continue;
            }
            const index = candleIndexAt(candles, item.atMs);
            const value = layer.dotValues[index];
            const timeMs = candles[index]?.timeMs;
            if (value == null || timeMs == null) {
              continue;
            }
            const time = Math.floor(timeMs / 1000);
            if (seen.has(time)) {
              continue;
            }
            seen.add(time);
            dots.push({ time, value });
          }
          row.dots.setData(dots as never);
        });
        if (follow) {
          const next = { from: end - 96, to: end + 8 };
          chart.timeScale().setVisibleLogicalRange(next);
          if (!initialRange) {
            initialRange = next;
          }
        }
        const selected = selectedRef.current;
        const plotted = events
          .filter(
            (row) =>
              row.kind === "fill" &&
              row.atMs <= at &&
              replayMarkerInPositionFocus(row.orderIndex, focusOrders),
          )
          .map((row) => {
            let barMs = row.atMs;
            for (const candle of candles) {
              if (candle.timeMs <= row.atMs) {
                barMs = candle.timeMs;
              } else {
                break;
              }
            }
            const selectedSame =
              selected != null &&
              selected.atMs === row.atMs &&
              selected.reason === row.reason &&
              selected.side === row.side &&
              selected.orderIndex === row.orderIndex;
            return {
              time: Math.floor(barMs / 1000) as never,
              position: row.side === "short" ? "aboveBar" as const : "belowBar" as const,
              color: selectedSame
                ? "#F4F4F5"
                : row.reason === "take_profit"
                  ? "#A78BFA"
                  : row.reason === "stop" || row.reason === "trailing"
                    ? "#F5B942"
                    : row.side === "short"
                      ? "#F07167"
                      : "#34D399",
              shape: row.side === "short" ? "arrowDown" as const : "arrowUp" as const,
              size: selectedSame ? 2 : 1,
              text: replayMarkLabel(row),
            };
          });
        if (
          selected &&
          selected.atMs <= at &&
          replayMarkerInPositionFocus(selected.orderIndex, focusOrders)
        ) {
          let barMs = selected.atMs;
          for (const candle of candles) {
            if (candle.timeMs <= selected.atMs) {
              barMs = candle.timeMs;
            } else {
              break;
            }
          }
          plotted.push({
            time: Math.floor(barMs / 1000) as never,
            position: selected.side === "short" ? "belowBar" : "aboveBar",
            color: "#F4F4F5",
            shape: selected.side === "short" ? "arrowUp" : "arrowDown",
            size: 2,
            text: "",
          });
        }
        markers.setMarkers(lineMode ? [] : plotted);
        lineMarkers.setMarkers(lineMode ? plotted : []);
      }
      chart.subscribeCrosshairMove((param) => {
        const time = typeof param.time === "number" ? param.time : null;
        if (!param.point || time == null) {
          setTip(null);
          setLegendIndex(null);
          return;
        }
        const barIndex = candles.findIndex(
          (row) => Math.floor(row.timeMs / 1000) === time,
        );
        setLegendIndex(barIndex >= 0 ? barIndex : null);
        const texts = events
          .filter((item) => {
            const index = candleIndexAt(candles, item.atMs);
            const bar = candles[index]?.timeMs;
            return (
              bar != null &&
              Math.floor(bar / 1000) === time &&
              replayMarkerInPositionFocus(
                item.orderIndex,
                positionFocusRef.current?.orders ?? null,
              )
            );
          })
          .map((item) => item.text);
        if (texts.length === 0) {
          setTip(null);
          return;
        }
        setTip({
          x: param.point.x,
          y: param.point.y,
          text: texts[texts.length - 1] ?? "",
        });
      });
      chart.subscribeClick((param) => {
        const time = typeof param.time === "number" ? param.time : null;
        if (time == null) {
          return;
        }
        const match = events.find((item) => {
          const index = candleIndexAt(candles, item.atMs);
          const bar = candles[index]?.timeMs;
          return (
            bar != null &&
            Math.floor(bar / 1000) === time &&
            replayMarkerInPositionFocus(
              item.orderIndex,
              positionFocusRef.current?.orders ?? null,
            )
          );
        });
        if (match) {
          if (selectedRef.current === match) {
            setSelectedEvent(null);
            return;
          }
          setSelectedEvent(match);
        }
      });
      function applyIndicatorStyles() {
        const { session, saved } = indicatorStyleStateRef.current;
        for (const [key, row] of drawnIndicatorsRef.current) {
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
        const up = appearanceColor(
          node,
          look.up,
          "--color-success",
          "#34D399",
          look.upOpacity,
        );
        const down = appearanceColor(
          node,
          look.down,
          "--color-danger",
          "#F07167",
          look.downOpacity,
        );
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
        closeSeries.applyOptions({ visible: look.series === "line" });
        paint(headRef.current, false);
      }
      applyAppearanceRef.current = applyAppearance;
      applyAppearance();
      applyIndicatorStylesRef.current = applyIndicatorStyles;
      applyIndicatorStyles();
      paint(headRef.current);
      if (!disposed) {
        setAppliedReferences((current) =>
          sameReferenceIds(current, paintedReferences) ? current : paintedReferences,
        );
      }
      const paintRef = { current: paint };
      const host = node as HTMLDivElement & {
        __paint?: (index: number) => void;
        __focus?: (index: number) => void;
        __focusRange?: (from: number, to: number) => void;
        __laneX?: (index: number) => number | null;
        __pan?: (
          dx: number,
          origin: { from: number; to: number } | null,
        ) => { from: number; to: number } | null;
        __wheel?: (x: number, deltaY: number, deltaMode: number) => void;
      };
      host.__paint = (index, follow = true) => paintRef.current(index, follow);
      host.__focus = (index) => {
        const at = Math.max(0, Math.min(index, candles.length - 1));
        chart.timeScale().setVisibleLogicalRange({
          from: at - 48,
          to: at + 48,
        });
      };
      host.__focusRange = (from, to) => {
        const scale = chart.timeScale();
        const next = replayPositionVisibleRange(
          from,
          to,
          scale.getVisibleLogicalRange(),
        );
        if (!next) {
          return;
        }
        scale.setVisibleLogicalRange(next);
      };
      host.__pan = (dx, origin) => {
        const scale = chart.timeScale();
        const width = scale.width();
        const range = origin ?? scale.getVisibleLogicalRange();
        if (!range || width === 0) {
          return null;
        }
        if (origin) {
          const span = origin.to - origin.from;
          const shift = (dx / width) * span;
          scale.setVisibleLogicalRange({
            from: origin.from - shift,
            to: origin.to - shift,
          });
        }
        return { from: range.from, to: range.to };
      };
      host.__wheel = (x, deltaY, deltaMode) => {
        const scale = chart.timeScale();
        const range = scale.getVisibleLogicalRange();
        const width = scale.width();
        if (!range || width === 0 || deltaY === 0) {
          return;
        }
        const scrollSpeed = deltaMode === 1 ? 32 : deltaMode === 2 ? 120 : 1;
        const adjusted = -(scrollSpeed * deltaY) / 100;
        if (adjusted === 0) {
          return;
        }
        const zoomScale = Math.sign(adjusted) * Math.min(1, Math.abs(adjusted));
        const factor = 1 + zoomScale / 10;
        if (factor <= 0) {
          return;
        }
        const span = range.to - range.from;
        const point = Math.max(1, Math.min(x, width));
        const anchor = range.from + (point / width) * span;
        const nextSpan = span / factor;
        const left = span === 0 ? 0 : (anchor - range.from) / span;
        scale.setVisibleLogicalRange({
          from: anchor - left * nextSpan,
          to: anchor + (1 - left) * nextSpan,
        });
      };
      host.__laneX = (index) => {
        const scale = chart.timeScale();
        const direct = scale.logicalToCoordinate(index as never);
        if (direct != null) {
          return Number(direct);
        }
        const range = scale.getVisibleLogicalRange();
        if (!range) {
          return null;
        }
        const span = range.to - range.from;
        if (span === 0) {
          return null;
        }
        const origin = scale.logicalToCoordinate(range.from as never);
        const left = origin == null ? 0 : Number(origin);
        return left + ((index - range.from) / span) * scale.width();
      };
      const onLaneRange = () => laneSyncRef.current();
      chart.timeScale().subscribeVisibleLogicalRangeChange(onLaneRange);
      function onChartWheel(event: WheelEvent) {
        if (event.deltaY === 0) {
          return;
        }
        setCursor((current) =>
          current.playing ? { ...current, playing: false } : current,
        );
      }
      node.addEventListener("wheel", onChartWheel, { capture: true, passive: true });
      const detachAxisWheel = attachRightAxisWheel(node, () => chart);
      if (focusSpanRef.current) {
        host.__focusRange?.(focusSpanRef.current.from, focusSpanRef.current.to);
      } else if (focusRef.current != null) {
        host.__focus(focusRef.current);
      }
      const observer = new ResizeObserver(() => {
        chart.applyOptions({
          width: node.clientWidth,
          height: node.clientHeight,
        });
        sizeOscillatorPanes(false);
        publishOscillatorTops();
      });
      observer.observe(node);
      const paneObserver = new ResizeObserver(() => {
        publishOscillatorTops();
      });
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
      function sizeOscillatorPanes(force: boolean) {
        const panes = chart.panes();
        const oscillatorCount = panes.length - 1;
        const total = node.clientHeight;
        const weights = oscillatorPaneStretch(total, oscillatorCount);
        if (!weights) {
          return;
        }
        const priceHeight = panes[0]?.getHeight() ?? 0;
        if (!force && priceHeight > 0 && priceHeight / total >= 0.5) {
          return;
        }
        panes[0]?.setStretchFactor(weights.price);
        for (let index = 1; index < panes.length; index += 1) {
          panes[index]?.setStretchFactor(weights.oscillator);
        }
      }
      sizeOscillatorPanes(true);
      requestAnimationFrame(() => {
        if (disposed) {
          return;
        }
        sizeOscillatorPanes(true);
        for (const pane of chart.panes()) {
          const element = pane.getHTMLElement();
          if (element) {
            paneObserver.observe(element);
          }
        }
        publishOscillatorTops();
      });
      cleanup = () => {
        observer.disconnect();
        paneObserver.disconnect();
        setOscillatorTops([]);
        node.removeEventListener("wheel", onChartWheel, { capture: true });
        detachAxisWheel();
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(onLaneRange);
        const chartHost = node as HTMLDivElement & {
          __paint?: (index: number) => void;
          __focus?: (index: number) => void;
          __focusRange?: (from: number, to: number) => void;
          __laneX?: (index: number) => number | null;
          __pan?: (
            dx: number,
            origin: { from: number; to: number } | null,
          ) => { from: number; to: number } | null;
          __wheel?: (x: number, deltaY: number, deltaMode: number) => void;
        };
        delete chartHost.__paint;
        delete chartHost.__focus;
        delete chartHost.__focusRange;
        delete chartHost.__laneX;
        delete chartHost.__pan;
        delete chartHost.__wheel;
        applyIndicatorStylesRef.current = null;
        applyAppearanceRef.current = null;
        resetChartRef.current = null;
        resetPriceRef.current = null;
        chartShotRef.current = null;
        drawnIndicatorsRef.current.clear();
        chart.remove();
      };
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [candles, series, events, started, positionsRight, fillViewport, deferredReferences]);

  useEffect(() => {
    if (savedAppearance === undefined) {
      return;
    }
    if (savedAppearance === null) {
      window.localStorage.removeItem(REPLAY_CHART_APPEARANCE_KEY);
      return;
    }
    window.localStorage.setItem(
      REPLAY_CHART_APPEARANCE_KEY,
      serializeReplayChartAppearance(savedAppearance),
    );
  }, [savedAppearance]);

  const appearanceKey = serializeReplayChartAppearance(chartAppearance);
  useEffect(() => {
    applyAppearanceRef.current?.();
  }, [appearanceKey]);

  useEffect(() => {
    applyIndicatorStylesRef.current?.();
    const node = hostRef.current as
      | (HTMLDivElement & {
          __paint?: (index: number, follow?: boolean) => void;
        })
      | null;
    node?.__paint?.(headRef.current, false);
  }, [sessionStyles, globalStyles]);

  useEffect(() => {
    const track = laneTrackRef.current;
    if (!sideLanes || !track) {
      return;
    }
    const node: HTMLDivElement = track;
    function onWheel(event: WheelEvent) {
      if (!event.cancelable) {
        return;
      }
      event.preventDefault();
      const host = hostRef.current as
        | (HTMLDivElement & {
            __wheel?: (x: number, deltaY: number, deltaMode: number) => void;
          })
        | null;
      const rect = node.getBoundingClientRect();
      host?.__wheel?.(event.clientX - rect.left, event.deltaY, event.deltaMode);
      setCursor((current) => ({ ...current, playing: false }));
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [sideLanes, eventGroups.length]);

  useEffect(() => {
    const node = hostRef.current as
      | (HTMLDivElement & {
          __paint?: (index: number) => void;
          __focus?: (index: number) => void;
        })
      | null;
    node?.__paint?.(head);
  }, [head]);

  useEffect(() => {
    const node = hostRef.current as
      | (HTMLDivElement & {
          __paint?: (index: number, follow?: boolean) => void;
        })
      | null;
    node?.__paint?.(headRef.current, false);
  }, [selectedEvent, positionFocus]);

  useEffect(() => {
    if (!sideLanes) {
      return;
    }
    const host = hostRef.current as
      | (HTMLDivElement & { __laneX?: (index: number) => number | null })
      | null;
    const track = laneTrackRef.current;
    if (!host?.__laneX || !track) {
      return;
    }
    const dx = host.getBoundingClientRect().left - track.getBoundingClientRect().left;
    setPlacedLanes(
      placeReplayLanes(eventGroups, candles, throughMs, (index) => {
        const x = host.__laneX?.(index);
        return x == null ? null : x + dx;
      }, track.clientWidth),
    );
  }, [sideLanes, laneFrame, eventGroups, candles, throughMs]);

  const positionRows = useMemo(
    () =>
      listBacktestCycles(visibleOrders).map((cycle, index) => ({
        ...cycle,
        tradeNumber: index + 1,
      })),
    [visibleOrders],
  );
  const comparePositions = useCallback(
    (left: (typeof positionRows)[number], right: (typeof positionRows)[number], key: string, dir: TableSortDir) => {
      if (key === "number") {
        return compareTableNum(left.tradeNumber, right.tradeNumber, dir);
      }
      if (key === "side") {
        return compareTableText(left.side, right.side, dir);
      }
      if (key === "status") {
        return compareTableText(left.status, right.status, dir);
      }
      if (key === "entry") {
        return compareTableNum(left.entryPrice, right.entryPrice, dir);
      }
      if (key === "exit") {
        return compareTableNum(left.exitPrice ?? -1, right.exitPrice ?? -1, dir);
      }
      if (key === "realized") {
        return compareTableNum(left.realizedUsdt, right.realizedUsdt, dir);
      }
      return 0;
    },
    [],
  );
  const positionsRef = useRef<HTMLElement | null>(null);
  const [fittedPageSize, setFittedPageSize] = useState(15);
  const [columnMin, setColumnMin] = useState<number | null>(null);
  const fitPage = positionsRight || fillViewport;
  const pageSize = fitPage ? fittedPageSize : 15;
  useEffect(() => {
    if (!fitPage) {
      return;
    }
    const section = positionsRef.current;
    if (!section) {
      return;
    }
    const node: HTMLElement = section;
    function fit() {
      const row = node.querySelector("tbody tr td:not([colspan])")?.parentElement;
      const head = node.querySelector("thead");
      const card = node.querySelector("[data-table-card]");
      const pager = card?.lastElementChild;
      const rowH = row instanceof HTMLElement ? row.getBoundingClientRect().height : 52;
      const headH = head instanceof HTMLElement ? head.getBoundingClientRect().height : 40;
      const pagerH = pager instanceof HTMLElement ? pager.getBoundingClientRect().height : 45;
      const slot = headH + pagerH + rowH * 15 + 2;
      setColumnMin(slot);
      const available = fillViewport ? Math.max(node.clientHeight, slot) : slot;
      const next = Math.max(
        15,
        Math.floor((available - headH - pagerH - 2) / Math.max(rowH, 1)),
      );
      setFittedPageSize((current) => (current === next ? current : next));
    }
    fit();
    if (!fillViewport) {
      return;
    }
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [fitPage, fillViewport, positionsRight, positionRows.length]);
  const positionTable = useClientTable(positionRows, comparePositions, {
    pageSize,
    defaultKey: "number",
    defaultDir: "desc",
  });

  const positions = (
    <section
      ref={positionsRef}
      className={`flex min-w-0 flex-col ${
        positionsRight
          ? `h-full ${fillViewport ? "min-h-0 overflow-hidden" : "min-h-[54rem]"}`
          : ""
      }`}
      style={
        positionsRight && !fillViewport && columnMin != null
          ? { minHeight: columnMin }
          : undefined
      }
    >
      <TableCard
        className="mt-0 flex h-full flex-1 flex-col"
        pager={
          positionRows.length === 0 ? undefined : (
            <TablePager
              scroll={false}
              window={positionTable.window}
              onPage={(page) => positionTable.setPage(page)}
              onPrev={() => positionTable.setPage(positionTable.window.page - 1)}
              onNext={() => positionTable.setPage(positionTable.window.page + 1)}
            />
          )
        }
      >
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <SortTh
                label="#"
                active={positionTable.sortKey === "number"}
                dir={positionTable.sortDir}
                onSort={() => positionTable.onSort("number")}
              />
              <SortTh
                label="Side"
                active={positionTable.sortKey === "side"}
                dir={positionTable.sortDir}
                onSort={() => positionTable.onSort("side")}
              />
              <SortTh
                label="Status"
                active={positionTable.sortKey === "status"}
                dir={positionTable.sortDir}
                onSort={() => positionTable.onSort("status")}
              />
              <SortTh
                label="Entry"
                active={positionTable.sortKey === "entry"}
                dir={positionTable.sortDir}
                onSort={() => positionTable.onSort("entry")}
              />
              <SortTh
                label="Exit"
                active={positionTable.sortKey === "exit"}
                dir={positionTable.sortDir}
                onSort={() => positionTable.onSort("exit")}
              />
              <SortTh
                label="Realized"
                active={positionTable.sortKey === "realized"}
                dir={positionTable.sortDir}
                onSort={() => positionTable.onSort("realized")}
              />
            </tr>
          </thead>
          <tbody>
            {positionRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-muted">
                  No fills yet at this point in the replay.
                </td>
              </tr>
            ) : (
              positionTable.pageRows.map((cycle) => {
                const open = openOrderKey === cycle.id;
                return (
                  <CycleRows
                    key={cycle.id}
                    cycle={cycle}
                    open={open}
                    viewing={positionFocus?.number === cycle.tradeNumber}
                    events={events}
                    orders={run.orders}
                    onToggle={() => setOpenOrderKey(open ? null : cycle.id)}
                    onShow={() => showTrade(cycle)}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </TableCard>
    </section>
  );

  const header = (
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <h1 className="shrink-0 text-2xl font-semibold tracking-tight">{run.symbol} replay</h1>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2">
          <div
            className="inline-flex overflow-hidden rounded-control border border-line"
            role="group"
            aria-label="Back"
          >
            <TransportButton
              label="Previous event"
              icon={<IconSkipBack size={16} className="size-4" />}
              onClick={() => jumpEvent(-1)}
            />
            <TransportButton
              label="Step back"
              icon={<IconStepBack size={16} className="size-4" />}
              divided
              onClick={() => {
                revealChart();
                setCursor((current) => ({
                  ...current,
                  playing: false,
                  head: Math.max(0, current.head - 1),
                }));
              }}
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-control bg-accent-strong px-3 py-1 text-sm text-ink"
            onClick={() => {
              if (!started) {
                beginPlayback();
                return;
              }
              setCursor((current) => ({ ...current, playing: !current.playing }));
            }}
          >
            {playing ? (
              <IconPause size={14} className="size-3.5 fill-current" />
            ) : (
              <IconPlay size={14} className="size-3.5 fill-current" />
            )}
            {playing ? "Pause" : "Play"}
          </button>
          <div
            className="inline-flex overflow-hidden rounded-control border border-line"
            role="group"
            aria-label="Forward"
          >
            <TransportButton
              label="Step forward"
              icon={<IconStepForward size={16} className="size-4" />}
              onClick={() => {
                revealChart();
                setCursor((current) => ({
                  ...current,
                  playing: false,
                  head: Math.min(candles.length - 1, current.head + 1),
                }));
              }}
            />
            <TransportButton
              label="Next event"
              icon={<IconSkipForward size={16} className="size-4" />}
              divided
              onClick={() => jumpEvent(1)}
            />
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Speed">
            {SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={speed === value}
                className={`rounded-control px-2 py-1 text-xs ${
                  speed === value
                    ? "bg-accent-strong text-ink"
                    : "text-ink-muted hover:text-ink"
                }`}
                onClick={() => setSpeed(value)}
              >
                {value}×
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-3 text-sm">
          <button
            type="button"
            title="Page layout settings"
            aria-label="Page layout settings"
            aria-expanded={layoutOpen}
            className="inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink"
            onClick={() => setLayoutOpen(true)}
          >
            <IconPageLayout {...FRAME_ICON} />
          </button>
          {layoutOpen ? (
            <Modal title="Page Layout Settings" onClose={() => setLayoutOpen(false)}>
              <div className="mt-4">
                <p className="text-xs text-ink">Display Positions</p>
                <div
                  role="group"
                  aria-label="Display Positions"
                  className="mt-2 flex rounded-full border border-line bg-canvas p-0.5"
                >
                  <button
                    type="button"
                    aria-pressed={!positionsRight}
                    className={`flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
                      positionsRight
                        ? "text-ink-muted hover:text-ink"
                        : "bg-accent-strong text-ink"
                    }`}
                    onClick={() => setPositionsRight(false)}
                  >
                    Below Chart
                  </button>
                  <button
                    type="button"
                    aria-pressed={positionsRight}
                    className={`flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
                      positionsRight
                        ? "bg-accent-strong text-ink"
                        : "text-ink-muted hover:text-ink"
                    }`}
                    onClick={() => setPositionsRight(true)}
                  >
                    Right of Chart
                  </button>
                </div>
              </div>
            </Modal>
          ) : null}
          {monitorFull ? null : (
            <button
              type="button"
              title={expanded ? "Exit browser fill" : "Fill browser"}
              aria-label={expanded ? "Exit browser fill" : "Fill browser"}
              className="inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? (
                <IconCollapse {...FRAME_ICON} />
              ) : (
                <IconExpand {...FRAME_ICON} />
              )}
            </button>
          )}
          <button
            type="button"
            title={monitorFull ? "Exit full screen" : "Full screen"}
            aria-label={monitorFull ? "Exit full screen" : "Full screen"}
            className="inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink"
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
        </div>
      </div>
  );

  const chartColumn = (
    <>
      <section
        className={`w-full min-w-0 overflow-hidden rounded-card border border-line bg-canvas ${
          positionsRight ? "flex min-h-0 flex-1 flex-col" : "min-h-[420px]"
        }`}
      >
        <ReplayChartBar
          run={run}
          interval={interval}
          onInterval={setInterval}
          appearance={chartAppearance}
          onChange={(patch) => {
            setSessionAppearance((current) => patchReplayChartAppearance(current, patch));
          }}
          onSave={(fields) => {
            const patch = pickReplayChartFields(sessionAppearance, fields);
            setSavedAppearance((saved) => saveReplayChartAppearance(saved ?? null, patch));
            setSessionAppearance((current) => clearReplayChartFields(current, fields));
          }}
          onReset={(fields) => {
            setSessionAppearance((current) => clearReplayChartFields(current, fields));
            setSavedAppearance((saved) => resetReplayChartFields(saved ?? null, fields));
          }}
          getChart={() => chartShotRef.current}
          screenshotName={`${run.symbol}-replay.png`}
          indicators={indicatorChoices}
          references={references}
          appliedReferences={appliedReferences}
          onToggleReference={(id, enabled) => {
            setReferences((current) =>
              enabled
                ? current.includes(id)
                  ? current
                  : [...current, id]
                : current.filter((row) => row !== id),
            );
          }}
        />
        <div
          className={`relative ${
            positionsRight ? "min-h-[12rem] min-w-0 flex-1" : ""
          }`}
        >
          <div
            ref={hostRef}
            className={
              positionsRight
                ? "absolute inset-0"
                : "h-[min(62vh,640px)] min-h-[420px] w-full min-w-0"
            }
            onContextMenu={(event) => {
              event.preventDefault();
              setChartMenu({ x: event.clientX, y: event.clientY });
            }}
          />
          {loading ? (
            <div
              className="absolute inset-0 flex items-center justify-center"
              role="status"
              aria-label="Loading candles"
            >
              <IconLoader className="size-16 animate-spin text-accent" />
            </div>
          ) : null}
          {!loading && candles.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-base text-ink-muted">
              {error ?? "No candles in that window."}
            </div>
          ) : null}
          {!loading && candles.length > 0 && !started ? (
            <button
              type="button"
              className="absolute inset-0 flex items-center justify-center"
              aria-label="Play replay"
              onClick={beginPlayback}
            >
              <span className="flex size-28 items-center justify-center rounded-full bg-accent-strong text-ink">
                <IconPlay size={52} className="ml-1 size-12" />
              </span>
            </button>
          ) : null}
          {legendRows.length > 0 && started ? (
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
                setSessionStyles((current) =>
                  writeIndicatorLineStyle(current, layerId, lineId, style),
                );
              }}
              onSaveGlobal={(layerId) => {
                setGlobalStyles((saved) =>
                  saveIndicatorStyleGlobal(saved ?? {}, sessionStyles, layerId),
                );
                setSessionStyles((current) => resetIndicatorStyle(current, layerId));
              }}
              onReset={(layerId) => {
                setSessionStyles((current) => resetIndicatorStyle(current, layerId));
                setGlobalStyles((current) => resetIndicatorStyle(current ?? {}, layerId));
              }}
              onInput={(layerId, inputId, value) => {
                if (!layerId.startsWith("ref:")) {
                  return;
                }
                const kind = layerId.slice(4) as keyof ReplayReferenceInputs;
                setReferenceInputs((current) => ({
                  ...current,
                  [kind]: { ...current[kind], [inputId]: value },
                }));
              }}
            />
          ) : null}
          {positionFocus ? (
            <div className="absolute right-24 top-2 z-20" role="status">
              <ViewingPositionNotice
                number={positionFocus.number}
                onClose={() => setPositionFocus(null)}
              />
            </div>
          ) : null}
          <ChartContextMenu
            menu={chartMenu}
            onClose={() => setChartMenu(null)}
            onResetChart={() => {
              setCursor((current) =>
                current.playing ? { ...current, playing: false } : current,
              );
              resetChartRef.current?.();
            }}
            onResetPrice={() => {
              setCursor((current) =>
                current.playing ? { ...current, playing: false } : current,
              );
              resetPriceRef.current?.();
            }}
          />
          {tip && started ? (
            <div
              className="pointer-events-none absolute z-10 max-w-sm rounded-control border border-line bg-surface-raised px-3 py-2 text-xs text-ink shadow-none"
              style={{
                left: Math.min(tip.x + 12, 520),
                top: Math.max(8, tip.y - 36),
              }}
            >
              {tip.text}
            </div>
          ) : null}
        </div>
        {started && candles.length > 0 ? (
          <label className="flex items-center gap-3 border-t border-line px-3 py-2 text-xs text-ink-muted">
            <span className="shrink-0">
              {head + 1} / {candles.length}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0, candles.length - 1)}
              value={Math.min(head, Math.max(0, candles.length - 1))}
              aria-label="Replay position"
              className="w-full accent-accent"
              onChange={(event) => {
                setCursor((current) => ({
                  ...current,
                  playing: false,
                  head: Number(event.target.value),
                }));
              }}
            />
          </label>
        ) : null}
      </section>

      {timeframeNote ? (
        <p className="text-xs text-ink-muted">{timeframeNote}</p>
      ) : null}

      <section className="rounded-card border border-line bg-surface px-4 py-3">
        <div className="relative flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Positions & Events</p>
          {positionFocus ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <ViewingPositionNotice
                number={positionFocus.number}
                onClose={() => setPositionFocus(null)}
              />
            </div>
          ) : null}
          <div
            role="group"
            aria-label="Event layout"
            className="flex shrink-0 rounded-full border border-line bg-canvas p-0.5"
          >
            <button
              type="button"
              aria-pressed={!sideLanes}
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${
                sideLanes ? "text-ink-muted hover:text-ink" : "bg-accent-strong text-ink"
              }`}
              onClick={() => setSideLanes(false)}
            >
              Continuous Events
            </button>
            <button
              type="button"
              aria-pressed={sideLanes}
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${
                sideLanes ? "bg-accent-strong text-ink" : "text-ink-muted hover:text-ink"
              }`}
              onClick={() => setSideLanes(true)}
            >
              Event Lanes
            </button>
          </div>
        </div>
        {eventGroups.length > 0 ? (
          sideLanes ? (
            <div
              ref={laneTrackRef}
              className="relative -mx-4 mt-3 h-[11rem] cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
              onPointerDown={onLanePointerDown}
              onPointerMove={onLanePointerMove}
              onPointerUp={onLanePointerUp}
              onPointerCancel={onLanePointerUp}
            >
              <ReplaySideLanes
                lanes={placedLanes}
                selected={selectedEvent}
                positionFocus={positionFocus}
                onSelect={showEvent}
                onShowPosition={showPosition}
              />
            </div>
          ) : (
            <div
              ref={eventStripRef}
              data-event-strip=""
              className="mt-3 flex items-end gap-3 overflow-x-auto pb-1"
            >
              <EventTradeGroups
                groups={eventGroups}
                throughMs={throughMs}
                selected={selectedEvent}
                positionFocus={positionFocus}
                onSelect={showEvent}
                onShowPosition={showPosition}
              />
            </div>
          )
        ) : null}
      </section>

      {selectedEvent ? (
        <EventParameters
          run={run}
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Trades" value={String(stats.trades)} />
        <Stat
          label="Win rate"
          value={stats.winRate == null ? "—" : `${(stats.winRate * 100).toFixed(0)}%`}
        />
        <Stat
          label="Realized"
          value={money(stats.realizedUsdt)}
          tone={signedTone(stats.realizedUsdt)}
        />
        <Stat label="Drawdown" value={money(-stats.maxDrawdownUsdt)} />
      </dl>
    </>
  );

  const body = (
    <div
      className={
        positionsRight
          ? `grid items-stretch gap-4 lg:grid-cols-[minmax(24rem,1fr)_32rem] ${
              fillViewport ? "min-h-0 flex-1" : ""
            }`
          : fillViewport
            ? "flex min-h-0 flex-1 flex-col gap-4 overflow-auto"
            : "space-y-4"
      }
    >
      <div
        className={
          positionsRight
            ? "flex h-full min-h-0 min-w-0 flex-col gap-4"
            : "flex min-w-0 flex-col gap-4"
        }
      >
        {chartColumn}
      </div>
      <div
        className={
          positionsRight ? "flex h-full min-w-0 flex-col" : "min-w-0"
        }
      >
        {positions}
      </div>
    </div>
  );

  const frame = (
    <div
      ref={frameRef}
      className={
        expanded && !monitorFull
          ? "fixed inset-0 z-50 flex h-dvh w-full flex-col gap-4 overflow-hidden bg-canvas p-4"
          : monitorFull
            ? "flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden bg-canvas p-4"
            : "space-y-4"
      }
    >
      {header}
      {body}
    </div>
  );

  return expanded && typeof document !== "undefined"
    ? createPortal(frame, document.body)
    : frame;
}

function EventParameters({
  run,
  event,
  onClose,
}: {
  run: BacktestRun;
  event: ReplayEvent;
  onClose: () => void;
}) {
  const sections = eventParameterSections(run.recipe, event);
  return (
    <section className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Parameters met</h2>
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink"
          aria-label="Close parameters"
          onClick={onClose}
        >
          <IconClose size={16} className="size-4" />
        </button>
      </div>
      <p className="mt-1 text-sm text-ink">{event.text}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {sections.map((section) => (
          <div key={section.role} className="rounded-control border border-line px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-ink-faint">{section.role}</p>
            {section.detail ? (
              <p className="mt-1 text-sm text-ink">{section.detail}</p>
            ) : null}
            <dl className="mt-2 space-y-1">
              {section.params.map((param) => (
                <div key={param.label} className="flex justify-between gap-3 text-sm">
                  <dt className="text-ink-muted">{param.label}</dt>
                  <dd className="text-right text-ink">{param.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

function ViewingPositionNotice({
  number,
  onClose,
}: {
  number: number;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-control border border-line bg-surface px-2.5 py-1 text-xs text-ink">
      <span>Viewing Position #{number}</span>
      <button
        type="button"
        className="inline-flex size-5 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink"
        aria-label="Show all positions"
        onClick={onClose}
      >
        <IconClose size={14} />
      </button>
    </div>
  );
}

function EventChipButton({
  row,
  selected,
  onSelect,
}: {
  row: ReplayEvent;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-selected-event={selected ? "" : undefined}
      className={`shrink-0 rounded-control border px-2 py-1 text-xs ${
        selected ? "border-accent text-ink" : "border-line text-ink-muted hover:text-ink"
      }`}
      onClick={onSelect}
    >
      {replayMarkLabel(row)}
    </button>
  );
}

function placeReplayLanes(
  groups: ReplayEventGroup[],
  candles: CandleBar[],
  throughMs: number,
  xOf: (index: number) => number | null,
  width: number,
): ReplayLaneDraw[] {
  const placed: ReplayLaneDraw[] = [];
  const sideIndex = { long: 0, short: 0 };
  for (const group of coalesceReplayPositions(groups)) {
    const side = group.side ?? group.events[0]?.side ?? null;
    if (side == null || group.events.length === 0) {
      continue;
    }
    const above = sideIndex[side] % 2 === 0;
    sideIndex[side] += 1;
    const start = group.events[0];
    if (!start) {
      continue;
    }
    const open = replayLaneStillOpen(group.events);
    const endMs = open ? throughMs : (group.events[group.events.length - 1]?.atMs ?? start.atMs);
    const xStart = xOf(candleIndexAt(candles, start.atMs));
    const xEnd = xOf(candleIndexAt(candles, endMs));
    if (xStart == null && xEnd == null) {
      continue;
    }
    const left = Math.min(xStart ?? xEnd ?? 0, xEnd ?? xStart ?? 0);
    const right = Math.max(xStart ?? xEnd ?? 0, xEnd ?? xStart ?? 0);
    const marks: ReplayLaneMark[] = [];
    group.events.forEach((row, index) => {
      const x = xOf(candleIndexAt(candles, row.atMs));
      if (x == null) {
        return;
      }
      marks.push({
        key: `${row.atMs}-${row.reason}-${index}`,
        x,
        labelX: x,
        label: replayMarkLabel(row),
        event: row,
      });
    });
    const tradeNumber = /^(\d+)/.exec(group.label)?.[1];
    const visibleLeft = Math.max(0, Math.min(width, left));
    const visibleRight = Math.max(0, Math.min(width, right));
    const onScreen = right >= 0 && left <= width && visibleRight >= visibleLeft;
    placed.push({
      id: group.id,
      tradeNumber: tradeNumber == null ? null : Number(tradeNumber),
      orderIndexes: group.events.flatMap((row) =>
        row.orderIndex == null ? [] : [row.orderIndex],
      ),
      side,
      label: onScreen
        ? tradeNumber == null
          ? group.label
          : `Position #${tradeNumber}`
        : "",
      above,
      x0: left,
      x1: right,
      labelX: (visibleLeft + visibleRight) / 2,
      fromMs: start.atMs,
      toMs: endMs,
      marks,
    });
  }
  settleReplayLaneText(placed, width);
  settleReplayLaneMarks(placed, width);
  return placed;
}

function settleReplayLaneMarks(lanes: ReplayLaneDraw[], width: number): void {
  const bounds = width > 0 ? { min: 0, max: width } : undefined;
  for (const side of ["long", "short"] as const) {
    for (const above of [true, false]) {
      const marks = lanes
        .filter((lane) => lane.side === side && lane.above === above)
        .flatMap((lane) => lane.marks);
      if (marks.length === 0) {
        continue;
      }
      const placed = separateLaneLabels(
        marks.map((mark) => ({ x: mark.x, width: replayEventLabelWidth(mark.label) })),
        8,
        bounds,
      );
      marks.forEach((mark, index) => {
        mark.labelX = placed[index] ?? mark.x;
      });
    }
  }
}

function settleReplayLaneText(lanes: ReplayLaneDraw[], width: number): void {
  for (const side of ["long", "short"] as const) {
    const rows = lanes.filter((lane) => lane.side === side);
    const captions: ReplayLaneLabelBox[] = [];
    const ordered = [...rows].sort((left, right) => left.labelX - right.labelX);
    for (const lane of ordered) {
      if (!lane.label) {
        continue;
      }
      const minX = Math.max(0, Math.min(lane.x0, lane.x1));
      const maxX = Math.min(width, Math.max(lane.x0, lane.x1));
      const brief = lane.label.replace(/^Position /, "");
      let text = fitLaneCaption(lane.label, Math.max(0, maxX - minX));
      let placed = placeLaneCaption(
        lane.labelX,
        replayLaneLabelWidth(text),
        minX,
        maxX,
        captions,
      );
      if (!placed.clear && text !== brief) {
        const shorter = placeLaneCaption(
          lane.labelX,
          replayLaneLabelWidth(brief),
          minX,
          maxX,
          captions,
        );
        if (shorter.clear) {
          text = brief;
          placed = shorter;
        }
      }
      captions.push({ x: placed.x, width: replayLaneLabelWidth(text) });
      lane.label = text;
      lane.labelX = placed.x;
    }
  }
}

function ReplaySideLanes({
  lanes,
  selected,
  positionFocus,
  onSelect,
  onShowPosition,
}: {
  lanes: ReplayLaneDraw[];
  selected: ReplayEvent | null;
  positionFocus: ChartPositionFocus | null;
  onSelect: (event: ReplayEvent) => void;
  onShowPosition: (hit: PositionHit) => void;
}) {
  return (
    <div className="relative h-full w-full" aria-label="Long and short lanes">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-line" />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-line" />
      {lanes.map((lane) => {
        const y = (px: number) =>
          lane.side === "short" ? `calc(50% + ${px}px)` : px;
        const barTop = y(30);
        const labelTop = y(34);
        const eventTop = y(lane.above ? 12 : 52);
        const dimmed =
          positionFocus != null &&
          !positionMatchesFocus(positionFocus, lane.orderIndexes);
        return (
          <div key={lane.id} className={dimmed ? "opacity-40 hover:opacity-70" : undefined}>
            <div
              className="absolute rounded-full"
              style={{
                left: lane.x0,
                width: Math.max(4, lane.x1 - lane.x0),
                top: barTop,
                height: 18,
                backgroundColor:
                  lane.side === "short"
                    ? "color-mix(in srgb, var(--color-danger) 30%, var(--color-surface))"
                    : "color-mix(in srgb, var(--color-success) 30%, var(--color-surface))",
              }}
            />
            {lane.label ? (
              <button
                type="button"
                className="absolute z-10 -translate-x-1/2 cursor-pointer whitespace-nowrap text-[10px] leading-none text-ink hover:underline"
                style={{ left: lane.labelX, top: labelTop }}
                onClick={() =>
                  onShowPosition({
                    id: lane.id,
                    number: lane.tradeNumber,
                    fromMs: lane.fromMs,
                    toMs: lane.toMs,
                  })
                }
              >
                {lane.label}
              </button>
            ) : null}
            {lane.marks.map((mark) => {
              const selectedMark = selected === mark.event;
              return (
                <button
                  key={mark.key}
                  type="button"
                  data-selected-event={selectedMark ? "" : undefined}
                  className={`absolute z-10 -translate-x-1/2 cursor-pointer whitespace-nowrap text-xs leading-none ${
                    selectedMark ? "text-ink underline" : "text-ink-muted"
                  }`}
                  style={{ left: mark.labelX, top: eventTop }}
                  onClick={() => onSelect(mark.event)}
                >
                  {mark.label}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

type ReplayLaneMark = {
  key: string;
  x: number;
  labelX: number;
  label: string;
  event: ReplayEvent;
};

type ReplayLaneDraw = {
  id: string;
  tradeNumber: number | null;
  orderIndexes: number[];
  side: "long" | "short";
  label: string;
  above: boolean;
  x0: number;
  x1: number;
  labelX: number;
  fromMs: number;
  toMs: number;
  marks: ReplayLaneMark[];
};

function positionMatchesFocus(
  focus: ChartPositionFocus,
  orderIndexes: readonly number[],
): boolean {
  return orderIndexes.some((index) => focus.orders.has(index));
}

function EventTradeGroups({
  groups,
  throughMs,
  selected,
  positionFocus,
  onSelect,
  onShowPosition,
}: {
  groups: ReturnType<typeof groupReplayEventsByPosition>;
  throughMs: number;
  selected: ReplayEvent | null;
  positionFocus: ChartPositionFocus | null;
  onSelect: (event: ReplayEvent) => void;
  onShowPosition: (hit: PositionHit) => void;
}) {
  return (
    <>
      {groups.map((group) => {
        const span = positionGroupSpan(groups, group.id, throughMs);
        const tradeNumber = /^(\d+)/.exec(group.label)?.[1];
        const number = tradeNumber == null ? null : Number(tradeNumber);
        const dimmed =
          positionFocus != null &&
          !positionMatchesFocus(
            positionFocus,
            group.events.flatMap((event) =>
              event.orderIndex == null ? [] : [event.orderIndex],
            ),
          );
        const title = (
          <button
            type="button"
            className="text-[10px] tracking-wide text-ink-faint hover:text-ink hover:underline"
            onClick={() => {
              if (span) {
                onShowPosition({
                  id: group.id,
                  number,
                  fromMs: span.fromMs,
                  toMs: span.toMs,
                });
              }
            }}
          >
            {positionGroupLabel(group.label)}
          </button>
        );
        return (
        <div
          key={group.id}
          className={`flex shrink-0 flex-col ${dimmed ? "opacity-40 hover:opacity-70" : ""}`}
        >
          {group.side ? (
            <div className="mb-1 flex items-end gap-1 px-0.5">
              <span className="h-2 w-px bg-line-strong" />
              <span className="h-px min-w-4 flex-1 bg-line-strong" />
              {title}
              <span className="h-px min-w-4 flex-1 bg-line-strong" />
              <span className="h-2 w-px bg-line-strong" />
            </div>
          ) : (
            <span className="mb-1">{title}</span>
          )}
          <div className="flex gap-2">
            {group.events.map((row, index) => (
              <EventChipButton
                key={`${row.atMs}-${row.reason}-${index}`}
                row={row}
                selected={selected === row}
                onSelect={() => onSelect(row)}
              />
            ))}
          </div>
        </div>
        );
      })}
    </>
  );
}

function positionGroupSpan(
  groups: ReplayEventGroup[],
  id: string,
  throughMs: number,
): { fromMs: number; toMs: number } | null {
  let fromMs = Number.POSITIVE_INFINITY;
  let toMs = 0;
  let open = false;
  let found = false;
  for (const group of groups) {
    if (group.id !== id) {
      continue;
    }
    found = true;
    if (replayLaneStillOpen(group.events)) {
      open = true;
    }
    for (const event of group.events) {
      fromMs = Math.min(fromMs, event.atMs);
      toMs = Math.max(toMs, event.atMs);
    }
  }
  if (!found) {
    return null;
  }
  return { fromMs, toMs: open ? Math.max(toMs, throughMs) : toMs };
}

type ChartPositionFocus = {
  number: number;
  orders: Set<number>;
};

type PositionHit = {
  id: string;
  number: number | null;
  fromMs: number;
  toMs: number;
};

function positionGroupLabel(label: string): string {
  const tradeNumber = /^(\d+)/.exec(label)?.[1];
  return tradeNumber == null ? label : `Position #${tradeNumber}`;
}

function replayMarkLabel(row: ReplayEvent): string {
  if (row.kind === "skipped") {
    return "Skipped";
  }
  if (row.reason === "entry") {
    return "Entry";
  }
  if (row.reason === "clip") {
    return "Add";
  }
  if (row.reason === "take_profit") {
    return "TP";
  }
  if (row.reason === "stop") {
    return "SL";
  }
  if (row.reason === "liquidation") {
    return "Liq";
  }
  return "Exit";
}

function TransportButton({
  label,
  icon,
  divided = false,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  divided?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex size-8 items-center justify-center text-ink-muted hover:bg-surface-raised hover:text-ink ${
        divided ? "border-l border-line" : ""
      }`}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface px-3 py-2">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className={`text-sm font-medium ${tone ?? "text-ink"}`}>{value}</dd>
    </div>
  );
}

function CycleRows({
  cycle,
  open,
  viewing,
  events,
  orders,
  onToggle,
  onShow,
}: {
  cycle: BacktestPositionCycle & { tradeNumber: number };
  open: boolean;
  viewing: boolean;
  events: ReplayEvent[];
  orders: BacktestRun["orders"];
  onToggle: () => void;
  onShow: () => void;
}) {
  return (
    <>
      <tr
        className={`border-b border-line last:border-b-0 ${viewing ? "bg-accent/15" : ""}`}
        aria-current={viewing ? "true" : undefined}
      >
        <td className="px-4 py-3">
          <button
            type="button"
            className="text-ink hover:underline"
            aria-label={`Show trade ${cycle.tradeNumber}`}
            onClick={onShow}
          >
            {cycle.tradeNumber}
          </button>
        </td>
        <td
          className={`px-4 py-3 capitalize ${
            cycle.side === "short" ? "text-danger" : "text-success"
          }`}
        >
          {cycle.side}
        </td>
        <td className="px-4 py-3 text-ink-muted">
          {cycle.status === "open" ? "Open" : "Closed"}
        </td>
        <td className="px-4 py-3 text-ink">{formatPrice(cycle.entryPrice)}</td>
        <td className="px-4 py-3 text-ink">
          {cycle.exitPrice == null ? "—" : formatPrice(cycle.exitPrice)}
        </td>
        <td className={`px-4 py-3 ${signedTone(cycle.realizedUsdt)}`}>
          <span className="inline-flex items-center gap-2">
            {money(cycle.realizedUsdt)}
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink"
              aria-expanded={open}
              aria-label={open ? "Hide orders" : "Show orders"}
              title={open ? "Hide orders" : "Show orders"}
              onClick={onToggle}
            >
              <IconChevronRight
                size={16}
                className={`size-4 ${open ? "rotate-90" : ""}`}
              />
            </button>
          </span>
        </td>
      </tr>
      {open
        ? cycle.orders.map((order) => {
            const orderIndex = orders.indexOf(order);
            const event = eventForOrder(events, order, orderIndex);
            return (
              <tr key={`${order.atMs}-${order.reason}-${order.price}`} className="border-b border-line bg-surface-raised last:border-b-0">
                <td colSpan={6} className="px-4 py-3 text-sm text-ink-muted">
                  <span className="text-ink">
                    {order.reason ?? "fill"} · {formatQty(order.qty)} @ {formatPrice(order.price)}
                  </span>
                  <span className="mt-1 block text-ink">{event?.text ?? "No stored reason for this fill."}</span>
                </td>
              </tr>
            );
          })
        : null}
    </>
  );
}
