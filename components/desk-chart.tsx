"use client";

import { useEffect, useRef } from "react";
import type { CandleBar } from "@/lib/market/candles";
import type { ChartOverlay } from "@/lib/charts/overlay";

export function DeskChart({
  candles,
  overlay,
  height = 420,
}: {
  candles: CandleBar[];
  overlay: ChartOverlay;
  height?: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    let disposed = false;
    let cleanup = () => {};

    void import("lightweight-charts").then((charts) => {
      if (disposed || !hostRef.current) {
        return;
      }
      const chart = charts.createChart(host, {
        layout: {
          background: { type: charts.ColorType.Solid, color: "#0B0E14" },
          textColor: "#9AA3B2",
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: "#2A313C" },
          horzLines: { color: "#2A313C" },
        },
        rightPriceScale: { borderColor: "#2A313C" },
        timeScale: { borderColor: "#2A313C", timeVisible: true },
        crosshair: { mode: charts.CrosshairMode.Normal },
        width: host.clientWidth,
        height,
      });
      const series = chart.addSeries(charts.CandlestickSeries, {
        upColor: "#34D399",
        downColor: "#F07167",
        borderUpColor: "#34D399",
        borderDownColor: "#F07167",
        wickUpColor: "#34D399",
        wickDownColor: "#F07167",
      });
      series.setData(
        candles.map((row) => ({
          time: Math.floor(row.timeMs / 1000) as never,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
        })),
      );
      for (const line of overlay.lines) {
        series.createPriceLine({
          price: line.price,
          title: line.title,
          color: line.color,
          lineWidth: 1,
          lineStyle: charts.LineStyle.Dashed,
          axisLabelVisible: true,
        });
      }
      if (overlay.markers.length > 0) {
        charts.createSeriesMarkers(
          series,
          overlay.markers.map((row) => ({
            time: row.timeSec as never,
            position: row.position,
            color: row.color,
            shape: row.shape,
            text: row.text,
          })),
        );
      }
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
  }, [candles, overlay, height]);

  if (candles.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-card border border-line bg-canvas text-sm text-ink-muted"
        style={{ height }}
      >
        No candles for this window.
      </div>
    );
  }

  return <div ref={hostRef} className="w-full" style={{ height }} />;
}
