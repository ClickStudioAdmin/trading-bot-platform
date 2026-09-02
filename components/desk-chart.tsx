"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChartContextMenu,
  type ChartContextMenuState,
} from "@/components/chart-context-menu";
import {
  attachRightAxisWheel,
  CHART_SCALE_OPTIONS,
  resetChartView,
  resetPriceScale,
  type ChartViewApi,
} from "@/lib/charts/interact";
import type { ChartOverlay } from "@/lib/charts/overlay";
import type { CandleBar } from "@/lib/market/candles";

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
  "inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink";

function CopyImageIcon() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" fill="none" aria-hidden>
      <rect
        x="6.25"
        y="6.25"
        width="8"
        height="8"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M11.5 6.1V4.7A1.2 1.2 0 0 0 10.3 3.5H4.7A1.2 1.2 0 0 0 3.5 4.7v5.6A1.2 1.2 0 0 0 4.7 11.5H6.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" fill="none" aria-hidden>
      <path
        d="M3.6 6.6h1.85l1.1-1.55h4.9L12.55 6.6H14.4A1.6 1.6 0 0 1 16 8.2v5.2a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 13.4V8.2a1.6 1.6 0 0 1 1.6-1.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="10.7" r="2.15" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" fill="none" aria-hidden>
      <path
        d="M4.5 9.2 7.4 12l6.1-6.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChartScreenshotControls({
  getChart,
  filename,
  className,
}: {
  getChart: () => ChartHandle | null;
  filename: string;
  className?: string;
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
    <div className={`flex items-center gap-0.5 ${className ?? ""}`.trim()}>
      <button
        type="button"
        title={
          copied ? "Copied" : copyFailed ? "Could not copy" : "Copy snapshot"
        }
        aria-label={
          copied ? "Copied" : copyFailed ? "Could not copy" : "Copy snapshot"
        }
        className={`${SHOT_BUTTON} ${copied ? "text-success" : copyFailed ? "text-danger" : ""}`}
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
        {copied ? <CheckIcon /> : <CopyImageIcon />}
      </button>
      <button
        type="button"
        title="Save snapshot"
        aria-label="Save snapshot"
        className={SHOT_BUTTON}
        onClick={() => {
          const chart = getChart();
          if (chart) {
            downloadChartScreenshot(chart, filename);
          }
        }}
      >
        <CameraIcon />
      </button>
    </div>
  );
}

const CHART_TOOLBAR_H = 36;

export function DeskChart({
  candles,
  overlay,
  height = 420,
  screenshotName = "chart.png",
  rightOffset = 0,
  toolbar,
  status = null,
  visibleRange = null,
}: {
  candles: CandleBar[];
  overlay: ChartOverlay;
  height?: number;
  screenshotName?: string;
  rightOffset?: number;
  toolbar?: ReactNode;
  status?: string | null;
  visibleRange?: { fromSec: number; toSec: number } | null;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ChartHandle | null>(null);
  const viewRef = useRef<ChartViewApi | null>(null);
  const [menu, setMenu] = useState<ChartContextMenuState>(null);
  const plotHeight = height - CHART_TOOLBAR_H;

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
          rightOffset,
        },
        ...CHART_SCALE_OPTIONS,
        crosshair: { mode: charts.CrosshairMode.Normal },
        width: host.clientWidth,
        height: plotHeight,
      });
      chartRef.current = chart;
      viewRef.current = chart;
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
      if (
        visibleRange &&
        visibleRange.toSec >= visibleRange.fromSec
      ) {
        try {
          chart.timeScale().setVisibleRange({
            from: visibleRange.fromSec as never,
            to: visibleRange.toSec as never,
          });
        } catch {
          chart.timeScale().fitContent();
        }
      } else {
        chart.timeScale().fitContent();
      }
      const detachWheel = attachRightAxisWheel(host, () => viewRef.current);
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
        viewRef.current = null;
        chart.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [candles, overlay, plotHeight, rightOffset, visibleRange]);

  return (
    <div
      className="flex w-full flex-col overflow-hidden rounded-card border border-line bg-canvas"
      style={{ height }}
    >
      <div className="flex min-h-9 shrink-0 items-center justify-between gap-2 border-b border-line px-1.5 py-1">
        <div className="min-w-0">{toolbar}</div>
        <ChartScreenshotControls
          getChart={() => chartRef.current}
          filename={screenshotName}
        />
      </div>
      <div className="relative min-h-0 w-full flex-1">
        <div
          ref={hostRef}
          className="h-full w-full"
          onContextMenu={(event) => {
            event.preventDefault();
            setMenu({ x: event.clientX, y: event.clientY });
          }}
        />
        {candles.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-sm text-ink-muted">
            {status ?? "No candles for this window."}
          </div>
        ) : null}
      </div>
      <ChartContextMenu
        menu={menu}
        onClose={() => setMenu(null)}
        onResetChart={() => {
          if (viewRef.current) {
            resetChartView(viewRef.current);
          }
        }}
        onResetPrice={() => {
          if (viewRef.current) {
            resetPriceScale(viewRef.current);
          }
        }}
      />
    </div>
  );
}
