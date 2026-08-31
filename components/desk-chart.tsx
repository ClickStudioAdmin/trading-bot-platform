"use client";

import { useEffect, useRef, useState } from "react";
import type { CandleBar } from "@/lib/market/candles";
import type { ChartOverlay } from "@/lib/charts/overlay";

type ChartHandle = {
  takeScreenshot: (
    addTopLayer?: boolean,
    includeCrosshair?: boolean,
  ) => HTMLCanvasElement;
};

function captureChartPng(chart: ChartHandle): Promise<Blob> {
  const canvas = chart.takeScreenshot(true, true);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Could not capture the chart."));
    }, "image/png");
  });
}

export function downloadChartScreenshot(
  chart: ChartHandle,
  filename: string,
) {
  void captureChartPng(chart).then((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  });
}

export async function copyChartScreenshot(chart: ChartHandle): Promise<boolean> {
  if (!navigator.clipboard?.write) {
    return false;
  }
  try {
    const blob = captureChartPng(chart);
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}

const SHOT_BUTTON =
  "rounded-control border border-line bg-surface/90 px-2 py-1 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink";

export function ChartScreenshotControls({
  getChart,
  filename,
}: {
  getChart: () => ChartHandle | null;
  filename: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    if (!copied && !copyFailed) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCopied(false);
      setCopyFailed(false);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [copied, copyFailed]);

  return (
    <div className="absolute top-2 right-2 z-10 flex gap-1">
      <button
        type="button"
        title="Copy screenshot"
        aria-label="Copy screenshot"
        className={SHOT_BUTTON}
        onClick={() => {
          const chart = getChart();
          if (!chart) {
            return;
          }
          void copyChartScreenshot(chart).then((ok) => {
            setCopied(ok);
            setCopyFailed(!ok);
          });
        }}
      >
        {copied ? "Copied" : copyFailed ? "Can't copy" : "Copy"}
      </button>
      <button
        type="button"
        title="Download screenshot"
        aria-label="Download screenshot"
        className={SHOT_BUTTON}
        onClick={() => {
          const chart = getChart();
          if (chart) {
            downloadChartScreenshot(chart, filename);
          }
        }}
      >
        Save
      </button>
    </div>
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
      <ChartScreenshotControls
        getChart={() => chartRef.current}
        filename={screenshotName}
      />
    </div>
  );
}
