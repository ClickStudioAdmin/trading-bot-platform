"use client";

import { useEffect, useRef } from "react";
import type { CandleBar } from "@/lib/market/candles";
import type { ChartOverlay } from "@/lib/charts/overlay";

type ChartHandle = {
  takeScreenshot: (
    addTopLayer?: boolean,
    includeCrosshair?: boolean,
  ) => HTMLCanvasElement;
};

export function downloadChartScreenshot(
  chart: ChartHandle,
  filename: string,
) {
  const canvas = chart.takeScreenshot(true, true);
  canvas.toBlob((blob) => {
    if (!blob) {
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

export function ChartScreenshotButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title="Screenshot"
      aria-label="Screenshot chart"
      onClick={onClick}
      className="absolute top-2 right-2 z-10 rounded-control border border-line bg-surface/90 px-2 py-1 text-ink-muted hover:bg-surface-raised hover:text-ink"
    >
      <CameraIcon />
    </button>
  );
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M4 8.5h2.2l1.3-2h9l1.3 2H20A1.5 1.5 0 0 1 21.5 10v7A1.5 1.5 0 0 1 20 18.5H4A1.5 1.5 0 0 1 2.5 17v-7A1.5 1.5 0 0 1 4 8.5Z" />
      <circle cx="12" cy="13.25" r="3.1" />
    </svg>
  );
}

export function DeskChart({
  candles,
  overlay,
  height = 420,
  screenshotName = "chart.png",
}: {
  candles: CandleBar[];
  overlay: ChartOverlay;
  height?: number;
  screenshotName?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ChartHandle | null>(null);

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
        timeScale: {
          borderColor: "#2A313C",
          timeVisible: true,
          rightOffset: 0,
          fixLeftEdge: true,
          fixRightEdge: true,
        },
        crosshair: { mode: charts.CrosshairMode.Normal },
        width: host.clientWidth,
        height,
      });
      chartRef.current = chart;
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
        chartRef.current = null;
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

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={hostRef} className="h-full w-full" />
      <ChartScreenshotButton
        onClick={() => {
          if (chartRef.current) {
            downloadChartScreenshot(chartRef.current, screenshotName);
          }
        }}
      />
    </div>
  );
}
