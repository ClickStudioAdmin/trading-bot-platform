"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BacktestChartIntervalBar } from "@/components/backtest-chart-interval";
import {
  ChartContextMenu,
  type ChartContextMenuState,
} from "@/components/chart-context-menu";
import { ChartScreenshotControls } from "@/components/desk-chart";
import {
  attachRightAxisWheel,
  CHART_SCALE_OPTIONS,
  resetChartView,
  resetPriceScale,
  type ChartViewApi,
} from "@/lib/charts/interact";
import {
  backtestChartFetchBounds,
  type BacktestRun,
} from "@/lib/backtest/model";
import { buildEquityTimeline } from "@/lib/backtest/study";
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";
import { loadBacktestDisplayCandles } from "@/lib/charts/load-backtest-candles";
import { clipCandlesToWindow, type CandleBar } from "@/lib/market/candles";

const HEIGHT = 280;

function money(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toSeriesPoints(
  points: Array<{ atMs: number; equityUsdt: number }>,
): Array<{ time: number; value: number }> {
  let last = 0;
  return points.map((row) => {
    let time = Math.max(1, Math.floor(row.atMs / 1000));
    if (time <= last) {
      time = last + 1;
    }
    last = time;
    return { time, value: row.equityUsdt };
  });
}

type ChartHandle = {
  takeScreenshot: (
    addTopLayer?: boolean,
    includeCrosshair?: boolean,
  ) => HTMLCanvasElement;
  applyOptions: (options: { width: number }) => void;
  remove: () => void;
} & ChartViewApi;

export function BacktestEquityPanel({
  run,
  interval,
  onIntervalChange,
}: {
  run: BacktestRun;
  interval: DcaIndicatorTimeframe;
  onIntervalChange: (value: DcaIndicatorTimeframe) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ChartHandle | null>(null);
  const [menu, setMenu] = useState<ChartContextMenuState>(null);
  const [candles, setCandles] = useState<CandleBar[]>([]);
  useEffect(() => {
    let cancelled = false;
    const bounds = backtestChartFetchBounds(run, interval);
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
          setCandles(clipCandlesToWindow(rows, bounds.fromMs, bounds.toMs));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCandles([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [run, interval]);
  const points = useMemo(
    () => buildEquityTimeline(run, candles),
    [run, candles],
  );
  const up = (points.at(-1)?.equityUsdt ?? 0) >= run.startingUsdt;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || points.length === 0) {
      return;
    }
    let disposed = false;
    let cleanup = () => {};
    const seriesPoints = toSeriesPoints(points);
    const line = up ? "#34D399" : "#F07167";
    const fill = up ? "rgba(52, 211, 153, 0.22)" : "rgba(240, 113, 103, 0.22)";

    void import("lightweight-charts").then((charts) => {
      if (disposed || !hostRef.current) {
        return;
      }
      const chart = charts.createChart(host, {
        layout: {
          background: { type: charts.ColorType.Solid, color: "#161B22" },
          textColor: "#9AA3B2",
          attributionLogo: false,
          fontSize: 12,
        },
        grid: {
          vertLines: { color: "#2A313C" },
          horzLines: { color: "#2A313C" },
        },
        rightPriceScale: {
          borderColor: "#2A313C",
          scaleMargins: { top: 0.12, bottom: 0.08 },
        },
        timeScale: {
          borderColor: "#2A313C",
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 0,
        },
        ...CHART_SCALE_OPTIONS,
        crosshair: {
          mode: charts.CrosshairMode.Normal,
          vertLine: { color: "#3A4352", labelBackgroundColor: "#1C222C" },
          horzLine: { color: "#3A4352", labelBackgroundColor: "#1C222C" },
        },
        localization: {
          priceFormatter: (value: number) => `$${money(value)}`,
        },
        width: host.clientWidth,
        height: HEIGHT,
      });
      const series = chart.addSeries(charts.AreaSeries, {
        lineColor: line,
        topColor: fill,
        bottomColor: "rgba(11, 14, 20, 0)",
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
        priceFormat: {
          type: "price",
          precision: 2,
          minMove: 0.01,
        },
      });
      series.setData(
        seriesPoints.map((row) => ({
          time: row.time as never,
          value: row.value,
        })),
      );
      series.createPriceLine({
        price: run.startingUsdt,
        title: "Start",
        color: "#9AA3B2",
        lineWidth: 1,
        lineStyle: charts.LineStyle.Dashed,
        axisLabelVisible: true,
      });
      chartRef.current = chart;
      chart.timeScale().fitContent();
      const detachWheel = attachRightAxisWheel(host, () => chartRef.current);
      const observer = new ResizeObserver(() => {
        if (hostRef.current) {
          chart.applyOptions({ width: hostRef.current.clientWidth });
        }
      });
      observer.observe(host);
      cleanup = () => {
        detachWheel();
        observer.disconnect();
        chartRef.current = null;
        chart.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [points, run.startingUsdt, up]);

  const start = points[0]?.equityUsdt ?? run.startingUsdt;
  const end = points.at(-1)?.equityUsdt ?? start;
  const change = end - start;
  const empty = points.length === 0;

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <BacktestChartIntervalBar
            run={run}
            interval={interval}
            onChange={onIntervalChange}
          />
        </div>
        {empty ? null : (
          <div className="flex items-center gap-3">
            <p
              className={`text-sm font-medium tabular-nums ${
                change >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {change >= 0 ? "+" : "−"}${money(Math.abs(change))} · ${money(end)}
            </p>
            <ChartScreenshotControls
              getChart={() => chartRef.current}
              filename={`${run.symbol}-equity.png`}
            />
          </div>
        )}
      </div>
      <div className="relative w-full" style={{ height: HEIGHT }}>
        <div
          ref={hostRef}
          className="h-full w-full"
          onContextMenu={(event) => {
            event.preventDefault();
            setMenu({ x: event.clientX, y: event.clientY });
          }}
        />
        <ChartContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onResetChart={() => {
            if (chartRef.current) {
              resetChartView(chartRef.current);
            }
          }}
          onResetPrice={() => {
            if (chartRef.current) {
              resetPriceScale(chartRef.current);
            }
          }}
        />
      </div>
    </div>
  );
}
