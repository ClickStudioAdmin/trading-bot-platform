"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BacktestChartIntervalBar } from "@/components/backtest-chart-interval";
import { replayChartSeries } from "@/lib/backtest/chart-series";
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

const SPEEDS = [1, 2, 4, 8] as const;
const EMPTY_CANDLES: CandleBar[] = [];

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
  const hostRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef(0);

  const loadKey = `${run.id}:${interval}`;
  const candles = load.key === loadKey ? load.candles : EMPTY_CANDLES
  const loading = load.key !== loadKey;
  const error = load.key === loadKey ? load.error : null;
  const candleKey = `${loadKey}:${candles.length}:${candles[0]?.timeMs ?? 0}`;
  const firstFill = events.find((row) => row.kind === "fill");
  const startHead = firstFill ? candleIndexAt(candles, firstFill.atMs) : 0;
  const [cursor, setCursor] = useState({ key: "", head: 0, playing: false });
  if (cursor.key !== candleKey) {
    setCursor({ key: candleKey, head: startHead, playing: false });
  }
  const head = cursor.key === candleKey ? cursor.head : startHead;
  const playing = cursor.key === candleKey ? cursor.playing : false;
  headRef.current = head;

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
        setCursor((current) => ({ ...current, playing: !current.playing }));
      } else if (event.key === "ArrowRight" && event.shiftKey) {
        event.preventDefault();
        jumpEvent(1);
      } else if (event.key === "ArrowLeft" && event.shiftKey) {
        event.preventDefault();
        jumpEvent(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setCursor((current) => ({
          ...current,
          playing: false,
          head: Math.min(candles.length - 1, current.head + 1),
        }));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
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
  const signalLabel = series.signalTimeframe
    ? DCA_INDICATOR_TIMEFRAME_LABELS[series.signalTimeframe]
    : null;
  const chartLabel = DCA_INDICATOR_TIMEFRAME_LABELS[interval];
  const timeframeNote =
    signalLabel && signalLabel !== chartLabel
      ? `This bot decided on ${signalLabel}. The lines on this ${chartLabel} chart are recalculated on these candles.`
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
    setCursor((current) => ({
      ...current,
      playing: false,
      head: candleIndexAt(candles, event.atMs),
    }));
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host || candles.length === 0) {
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
      const priceSeries = series.price.map((plot) =>
        chart.addSeries(charts.LineSeries, {
          color: plot.color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          title: plot.title,
        }),
      );
      const oscillatorSeries: {
        rsi: ReturnType<typeof chart.addSeries> | null;
        macd: ReturnType<typeof chart.addSeries> | null;
        signal: ReturnType<typeof chart.addSeries> | null;
        histogram: ReturnType<typeof chart.addSeries> | null;
      } = { rsi: null, macd: null, signal: null, histogram: null };
      if (series.oscillator) {
        chart.addPane();
        if (series.oscillator.rsi) {
          oscillatorSeries.rsi = chart.addSeries(
            charts.LineSeries,
            {
              color: "#A78BFA",
              lineWidth: 2,
              priceLineVisible: false,
              title: series.oscillator.title,
            },
            1,
          );
          if (series.oscillator.level != null) {
            oscillatorSeries.rsi.createPriceLine({
              price: series.oscillator.level,
              color: "#F5B942",
              lineWidth: 1,
              lineStyle: charts.LineStyle.Dashed,
              title: String(series.oscillator.level),
            });
          }
        }
        if (series.oscillator.histogram) {
          oscillatorSeries.histogram = chart.addSeries(
            charts.HistogramSeries,
            { priceLineVisible: false, title: "Histogram" },
            1,
          );
          oscillatorSeries.macd = chart.addSeries(
            charts.LineSeries,
            { color: "#A78BFA", lineWidth: 2, priceLineVisible: false, title: "MACD" },
            1,
          );
          oscillatorSeries.signal = chart.addSeries(
            charts.LineSeries,
            { color: "#F5B942", lineWidth: 2, priceLineVisible: false, title: "Signal" },
            1,
          );
        }
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
        series.price.forEach((plot, plotIndex) => {
          priceSeries[plotIndex]?.setData(
            lineData(candles, plot.values, end) as never,
          );
        });
        if (series.oscillator?.rsi && oscillatorSeries.rsi) {
          oscillatorSeries.rsi.setData(
            lineData(candles, series.oscillator.rsi, end) as never,
          );
        }
        if (series.oscillator?.histogram && oscillatorSeries.histogram) {
          oscillatorSeries.histogram.setData(
            lineData(candles, series.oscillator.histogram, end).map((row) => ({
              ...row,
              color: (row.value ?? 0) >= 0 ? "#34D399" : "#F07167",
            })) as never,
          );
          oscillatorSeries.macd?.setData(
            lineData(candles, series.oscillator.macd ?? [], end) as never,
          );
          oscillatorSeries.signal?.setData(
            lineData(candles, series.oscillator.signal ?? [], end) as never,
          );
        }
        const at = candles[end]?.timeMs ?? 0;
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
  }, [candles, series, events]);

  useEffect(() => {
    const node = hostRef.current as
      | (HTMLDivElement & { __paint?: (index: number) => void })
      | null;
    node?.__paint?.(head);
  }, [head]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{run.symbol} replay</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {run.replayEvents
              ? "Play the run. Each event names the rule that allowed it."
              : "This run was saved before event reasons. Play still shows the fills. Run it again for the full sentences."}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
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

      <section className="overflow-hidden rounded-card border border-line bg-canvas">
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
              onClick={() =>
                setCursor((current) => ({ ...current, playing: !current.playing }))
              }
            >
              {playing ? "Pause" : "Play"}
            </button>
            <TransportButton
              label="Step forward"
              onClick={() => {
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
        <div ref={hostRef} className="h-[min(62vh,640px)] w-full" />
        {candles.length === 0 ? (
          <p className="px-3 py-6 text-sm text-ink-muted">
            {loading ? "Loading candles…" : (error ?? "No candles in that window.")}
          </p>
        ) : (
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
        )}
      </section>

      {timeframeNote ? (
        <p className="text-xs text-ink-muted">{timeframeNote}</p>
      ) : null}

      <section className="rounded-card border border-line bg-surface px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-ink-faint">Event</p>
        <p className="mt-1 text-sm text-ink">
          {currentEvent?.text ?? "Press play. Events appear here as the run reaches them."}
        </p>
        {visibleEvents.length > 1 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {visibleEvents.slice(-12).map((row, index) => (
              <button
                key={`${row.atMs}-${row.reason}-${index}`}
                type="button"
                className={`shrink-0 rounded-control border px-2 py-1 text-xs ${
                  row === currentEvent
                    ? "border-accent text-ink"
                    : "border-line text-ink-muted hover:text-ink"
                }`}
                onClick={() => {
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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Positions</h2>
        {cycles.open.length === 0 && cycles.closed.length === 0 ? (
          <p className="text-sm text-ink-muted">No fills yet at this point in the replay.</p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-xs text-ink-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Side</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Entry</th>
                  <th className="px-3 py-2 font-medium">Exit</th>
                  <th className="px-3 py-2 font-medium">Realized</th>
                </tr>
              </thead>
              <tbody>
                {[...cycles.open, ...cycles.closed].map((cycle) => {
                  const key = cycle.id;
                  const open = openOrderKey === key;
                  return (
                    <CycleRows
                      key={key}
                      cycle={cycle}
                      open={open}
                      events={events}
                      orders={run.orders}
                      onToggle={() => setOpenOrderKey(open ? null : key)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
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
      <tr className="border-b border-line">
        <td className="px-3 py-2 capitalize text-ink">{cycle.side}</td>
        <td className="px-3 py-2 text-ink-muted">
          {cycle.status === "open" ? "Open" : "Closed"}
        </td>
        <td className="px-3 py-2 text-ink">{formatPrice(cycle.entryPrice)}</td>
        <td className="px-3 py-2 text-ink">
          {cycle.exitPrice == null ? "—" : formatPrice(cycle.exitPrice)}
        </td>
        <td className={`px-3 py-2 ${signedTone(cycle.realizedUsdt)}`}>
          {money(cycle.realizedUsdt)}
          <button
            type="button"
            className="ml-3 text-xs text-accent hover:underline"
            onClick={onToggle}
          >
            {open ? "Hide orders" : "Orders"}
          </button>
        </td>
      </tr>
      {open
        ? cycle.orders.map((order) => {
            const orderIndex = orders.indexOf(order);
            const event = eventForOrder(events, order, orderIndex);
            return (
              <tr key={`${order.atMs}-${order.reason}-${order.price}`} className="bg-surface">
                <td colSpan={5} className="px-3 py-2 text-sm text-ink-muted">
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
