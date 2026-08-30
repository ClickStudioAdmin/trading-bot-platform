"use client";

import { useEffect, useMemo, useRef } from "react";
import type { BacktestRun } from "@/lib/backtest/model";
import { buildEquityTimeline } from "@/lib/backtest/study";

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

export function BacktestEquityPanel({ run }: { run: BacktestRun }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const points = useMemo(() => buildEquityTimeline(run), [run]);
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
        },
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
      chart.timeScale().fitContent();
      const observer = new ResizeObserver(() => {
        if (hostRef.current) {
          chart.applyOptions({ width: hostRef.current.clientWidth });
        }
      });
      observer.observe(host);
      cleanup = () => {
        observer.disconnect();
        chart.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [points, run.startingUsdt, up]);

  if (points.length === 0) {
    return (
      <p className="text-sm text-ink-muted">No account timeline yet.</p>
    );
  }

  const start = points[0]?.equityUsdt ?? run.startingUsdt;
  const end = points.at(-1)?.equityUsdt ?? start;
  const change = end - start;

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-4 py-2">
        <p className="text-xs text-ink-muted">
          Equity · start ${money(start)}
        </p>
        <p
          className={`text-sm font-medium tabular-nums ${
            change >= 0 ? "text-success" : "text-danger"
          }`}
        >
          {change >= 0 ? "+" : "−"}${money(Math.abs(change))} · ${money(end)}
        </p>
      </div>
      <div ref={hostRef} className="w-full" style={{ height: HEIGHT }} />
    </div>
  );
}
