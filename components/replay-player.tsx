"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BacktestChartIntervalBar } from "@/components/backtest-chart-interval";
import {
  indicatorRolesForReason,
  replayChartSeries,
} from "@/lib/backtest/chart-series";
import { eventParameterSections } from "@/lib/backtest/event-pane";
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
  backtestRerunHref,
  type BacktestRun,
  type ReplayEvent,
} from "@/lib/backtest/model";
import { groupBacktestOrdersIntoCycles } from "@/lib/backtest/positions";
import {
  DCA_INDICATOR_TIMEFRAME_LABELS,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import { loadBacktestDisplayCandles } from "@/lib/charts/load-backtest-candles";
import { clipCandlesToWindow, type CandleBar } from "@/lib/market/candles";
import { formatPrice, formatQty, signedTone } from "@/lib/opportunities/format";
import {
  IconChevronRight,
  IconCollapse,
  IconExitMonitor,
  IconExpand,
  IconLoader,
  IconMonitor,
  IconPlay,
} from "@/components/icons";
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

function cssVar(node: HTMLElement, name: string, fallback: string): string {
  const value = getComputedStyle(node).getPropertyValue(name).trim();
  return value || fallback;
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
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(
    null,
  );
  const hostRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef(0);
  const [playback, setPlayback] = useState({ key: "", started: false });
  const [expanded, setExpanded] = useState(false);
  const [monitorFull, setMonitorFull] = useState(false);
  const [positionsRight, setPositionsRight] = useState(false);

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
  const currentEvent = visibleEvents[visibleEvents.length - 1] ?? null;
  const stats = replayPlayStats(visibleOrders, run.startingUsdt);
  const cycles = groupBacktestOrdersIntoCycles(visibleOrders);
  const series = useMemo(
    () => replayChartSeries(run.recipe, candles),
    [run.recipe, candles],
  );
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

  useEffect(() => {
    const host = hostRef.current;
    if (!started || !host || candles.length === 0) {
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
      const candleSeries = chart.addSeries(charts.CandlestickSeries, {
        upColor: "#34D399",
        downColor: "#F07167",
        borderUpColor: "#34D399",
        borderDownColor: "#F07167",
        wickUpColor: "#34D399",
        wickDownColor: "#F07167",
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
      for (const layer of series.layers) {
        let pane = 0;
        if (layer.pane === "oscillator") {
          chart.addPane();
          paneCursor += 1;
          pane = paneCursor;
          chart.panes()[pane]?.setHeight(68);
        }
        const lines = layer.price.map((plot) =>
          chart.addSeries(
            charts.LineSeries,
            {
              color: plot.color,
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
              title: plot.title,
            },
            pane,
          ),
        );
        const oscillator = {
          rsi: null as ReturnType<typeof chart.addSeries> | null,
          macd: null as ReturnType<typeof chart.addSeries> | null,
          signal: null as ReturnType<typeof chart.addSeries> | null,
          histogram: null as ReturnType<typeof chart.addSeries> | null,
        };
        if (layer.oscillator?.rsi) {
          oscillator.rsi = chart.addSeries(
            charts.LineSeries,
            {
              color: "#A78BFA",
              lineWidth: 2,
              priceLineVisible: false,
              title: layer.title,
            },
            pane,
          );
          for (const level of layer.oscillator.levels) {
            oscillator.rsi.createPriceLine({
              price: level,
              color: "#F5B942",
              lineWidth: 1,
              lineStyle: charts.LineStyle.Dashed,
              title: String(level),
            });
          }
        }
        if (layer.oscillator?.histogram) {
          oscillator.histogram = chart.addSeries(
            charts.HistogramSeries,
            { priceLineVisible: false, title: "Histogram" },
            pane,
          );
          oscillator.macd = chart.addSeries(
            charts.LineSeries,
            {
              color: "#A78BFA",
              lineWidth: 2,
              priceLineVisible: false,
              title: "MACD",
            },
            pane,
          );
          oscillator.signal = chart.addSeries(
            charts.LineSeries,
            {
              color: "#F5B942",
              lineWidth: 2,
              priceLineVisible: false,
              title: "Signal",
            },
            pane,
          );
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
          },
          pane,
        );
        drawn.push({ lines, dots, oscillator });
      }
      const markers = charts.createSeriesMarkers(candleSeries, []);
      function paint(index: number) {
        const end = Math.max(0, Math.min(index, candles.length - 1));
        const shown = candles.slice(0, end + 1);
        candleSeries.setData(
          shown.map((row) => ({
            time: Math.floor(row.timeMs / 1000) as never,
            open: row.open,
            high: row.high,
            low: row.low,
            close: row.close,
          })),
        );
        const at = candles[end]?.timeMs ?? 0;
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
            row.oscillator.histogram.setData(
              lineData(candles, layer.oscillator.histogram, end).map((point) => ({
                ...point,
                color: (point.value ?? 0) >= 0 ? "#34D399" : "#F07167",
              })) as never,
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
          for (const item of events) {
            if (item.atMs > at) {
              continue;
            }
            const roles = indicatorRolesForReason(item.reason);
            if (!roles.some((role) => layer.roles.includes(role))) {
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
        chart.timeScale().setVisibleLogicalRange({
          from: end - 96,
          to: end + 8,
        });
        markers.setMarkers(
          events
            .filter((row) => row.kind === "fill" && row.atMs <= at)
            .map((row) => {
              let barMs = row.atMs;
              for (const candle of candles) {
                if (candle.timeMs <= row.atMs) {
                  barMs = candle.timeMs;
                } else {
                  break;
                }
              }
              return {
              time: Math.floor(barMs / 1000) as never,
              position: row.side === "short" ? "aboveBar" : "belowBar",
              color: row.reason === "take_profit"
                ? "#A78BFA"
                : row.reason === "stop" || row.reason === "trailing"
                  ? "#F5B942"
                  : row.side === "short"
                    ? "#F07167"
                    : "#34D399",
              shape: row.side === "short" ? "arrowDown" : "arrowUp",
              text: row.reason === "entry"
                ? "Entry"
                : row.reason === "clip"
                  ? "Add"
                  : row.reason === "take_profit"
                    ? "TP"
                    : row.reason === "stop"
                      ? "SL"
                      : row.reason === "liquidation"
                        ? "Liq"
                        : "Exit",
            };
            }),
        );
      }
      chart.subscribeCrosshairMove((param) => {
        const time = typeof param.time === "number" ? param.time : null;
        if (!param.point || time == null) {
          setTip(null);
          return;
        }
        const texts = events
          .filter((item) => {
            const index = candleIndexAt(candles, item.atMs);
            const bar = candles[index]?.timeMs;
            return bar != null && Math.floor(bar / 1000) === time;
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
          return bar != null && Math.floor(bar / 1000) === time;
        });
        if (match) {
          setSelectedEvent(match);
        }
      });
      paint(headRef.current);
      const paintRef = { current: paint };
      (node as HTMLDivElement & { __paint?: (index: number) => void }).__paint =
        (index) => paintRef.current(index);
      const observer = new ResizeObserver(() => {
        chart.applyOptions({
          width: node.clientWidth,
          height: node.clientHeight,
        });
      });
      observer.observe(node);
      cleanup = () => {
        observer.disconnect();
        delete (node as HTMLDivElement & { __paint?: (index: number) => void }).__paint;
        chart.remove();
      };
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [candles, series, events, started]);

  useEffect(() => {
    const node = hostRef.current as
      | (HTMLDivElement & { __paint?: (index: number) => void })
      | null;
    node?.__paint?.(head);
  }, [head]);

  const positionRows = useMemo(
    () => [...cycles.open, ...cycles.closed],
    [cycles.open, cycles.closed],
  );
  const comparePositions = useCallback(
    (left: BacktestPositionCycle, right: BacktestPositionCycle, key: string, dir: TableSortDir) => {
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
  const positionTable = useClientTable(positionRows, comparePositions, {
    pageSize: 20,
    defaultKey: "entry",
    defaultDir: "asc",
  });

  const positions = (
    <section className="min-w-0">
      {positionRows.length === 0 ? (
        <p className="text-sm text-ink-muted">No fills yet at this point in the replay.</p>
      ) : (
        <TableCard
          className="mt-0"
          pager={
            <TablePager
              window={positionTable.window}
              onPage={(page) => positionTable.setPage(page)}
              onPrev={() => positionTable.setPage(positionTable.window.page - 1)}
              onNext={() => positionTable.setPage(positionTable.window.page + 1)}
            />
          }
        >
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
              <tr>
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
              {positionTable.pageRows.map((cycle) => {
                const open = openOrderKey === cycle.id;
                return (
                  <CycleRows
                    key={cycle.id}
                    cycle={cycle}
                    open={open}
                    events={events}
                    orders={run.orders}
                    onToggle={() => setOpenOrderKey(open ? null : cycle.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </TableCard>
      )}
    </section>
  );

  const header = (
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{run.symbol} replay</h1>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3 text-sm">
          <div className="flex items-center gap-1" role="group" aria-label="Positions layout">
            <button
              type="button"
              aria-pressed={!positionsRight}
              className={`rounded-control px-2 py-1 text-xs ${
                positionsRight
                  ? "text-ink-muted hover:text-ink"
                  : "bg-accent-strong text-ink"
              }`}
              onClick={() => setPositionsRight(false)}
            >
              Positions below
            </button>
            <button
              type="button"
              aria-pressed={positionsRight}
              className={`rounded-control px-2 py-1 text-xs ${
                positionsRight
                  ? "bg-accent-strong text-ink"
                  : "text-ink-muted hover:text-ink"
              }`}
              onClick={() => setPositionsRight(true)}
            >
              Positions right
            </button>
          </div>
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
          <Link
            href={`/account/backtests/${run.id}`}
            className="text-accent hover:underline"
          >
            Report
          </Link>
          <Link href={backtestRerunHref(run.id)} className="text-accent hover:underline">
            Load into new backtest
          </Link>
        </div>
      </div>
  );

  const chartColumn = (
    <>
      <section
        className={`w-full min-w-0 overflow-hidden rounded-card border border-line bg-canvas ${
          fillViewport ? "flex min-h-[420px] flex-1 flex-col" : "min-h-[420px]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
          <BacktestChartIntervalBar
            run={run}
            interval={interval}
            onChange={(value) => {
              setInterval(value);
            }}
          />
          <div className="flex flex-wrap items-center gap-1">
            <TransportButton
              label="Previous event"
              onClick={() => jumpEvent(-1)}
            />
            <TransportButton
              label="Step back"
              onClick={() => {
                revealChart();
                setCursor((current) => ({
                  ...current,
                  playing: false,
                  head: Math.max(0, current.head - 1),
                }));
              }}
            />
            <button
              type="button"
              className="rounded-control bg-accent-strong px-3 py-1 text-sm text-ink"
              onClick={() => {
                if (!started) {
                  beginPlayback();
                  return;
                }
                setCursor((current) => ({ ...current, playing: !current.playing }));
              }}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <TransportButton
              label="Step forward"
              onClick={() => {
                revealChart();
                setCursor((current) => ({
                  ...current,
                  playing: false,
                  head: Math.min(candles.length - 1, current.head + 1),
                }));
              }}
            />
            <TransportButton label="Next event" onClick={() => jumpEvent(1)} />
            <div className="ml-2 flex items-center gap-1" role="group" aria-label="Speed">
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
        </div>
        <div className={`relative ${fillViewport ? "min-h-0 flex-1" : ""}`}>
          <div
            ref={hostRef}
            className={
              fillViewport
              ? "absolute inset-0 min-h-[420px]"
              : "h-[min(62vh,640px)] min-h-[420px] w-full min-w-0"
            }
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
        <p className="text-xs uppercase tracking-wide text-ink-faint">Event</p>
        <button
          type="button"
          className="mt-1 text-left text-sm text-ink"
          disabled={!currentEvent}
          onClick={() => {
            if (currentEvent) {
              setSelectedEvent(currentEvent);
            }
          }}
        >
          {currentEvent?.text ?? "Press play. Events appear here as the run reaches them."}
        </button>
        {visibleEvents.length > 1 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {visibleEvents.slice(-12).map((row, index) => (
              <button
                key={`${row.atMs}-${row.reason}-${index}`}
                type="button"
                className={`shrink-0 rounded-control border px-2 py-1 text-xs ${
                  selectedEvent === row
                    ? "border-accent text-ink"
                    : "border-line text-ink-muted hover:text-ink"
                }`}
                onClick={() => {
                  revealChart();
                  setSelectedEvent(row);
                  setCursor((current) => ({
                    ...current,
                    playing: false,
                    head: candleIndexAt(candles, row.atMs),
                  }));
                }}
              >
                {eventChip(row)}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {selectedEvent ? (
        <EventParameters run={run} event={selectedEvent} />
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

  const body = positionsRight ? (
    <div
      className={`grid items-stretch gap-4 lg:grid-cols-[minmax(24rem,1fr)_32rem] ${
        fillViewport ? "min-h-0 flex-1" : ""
      }`}
    >
      <div
        className={
          fillViewport
            ? "flex min-h-0 min-w-0 flex-col gap-4 overflow-auto"
            : "min-w-0 space-y-4"
        }
      >
        {chartColumn}
      </div>
      <div
        className={
          fillViewport
            ? "min-h-0 min-w-0 overflow-auto"
            : "min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-8rem)] lg:overflow-auto"
        }
      >
        {positions}
      </div>
    </div>
  ) : (
    <div
      className={
        fillViewport ? "flex min-h-0 flex-1 flex-col gap-4 overflow-auto" : "space-y-4"
      }
    >
      {chartColumn}
      {positions}
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
}: {
  run: BacktestRun;
  event: ReplayEvent;
}) {
  const sections = eventParameterSections(run.recipe, event);
  return (
    <section className="rounded-card border border-line bg-surface px-4 py-3">
      <h2 className="text-sm font-semibold text-ink">Parameters met</h2>
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

function eventChip(row: ReplayEvent): string {
  if (row.kind === "skipped") {
    return "Skipped";
  }
  if (row.reason === "entry") {
    return `Entry ${row.side}`;
  }
  if (row.reason === "clip") {
    return `Add ${row.clipIndex ?? ""}`.trim();
  }
  if (row.reason === "take_profit") {
    return "Take profit";
  }
  if (row.reason === "stop") {
    return "Stop";
  }
  if (row.reason === "liquidation") {
    return "Liquidation";
  }
  return "Exit";
}

function TransportButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="rounded-control border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink"
      onClick={onClick}
    >
      {label}
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
  events,
  orders,
  onToggle,
}: {
  cycle: ReturnType<typeof groupBacktestOrdersIntoCycles>["closed"][number];
  open: boolean;
  events: ReplayEvent[];
  orders: BacktestRun["orders"];
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-line last:border-b-0">
        <td className="px-4 py-3 capitalize text-ink">{cycle.side}</td>
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
                <td colSpan={5} className="px-4 py-3 text-sm text-ink-muted">
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
