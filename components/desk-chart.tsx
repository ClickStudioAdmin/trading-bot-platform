"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ChartContextMenu,
  type ChartContextMenuState,
} from "@/components/chart-context-menu";
import {
  IconCamera,
  IconCheck,
  IconCollapse,
  IconCopy,
  IconExitMonitor,
  IconExpand,
  IconMonitor,
} from "@/components/icons";
import {
  attachRightAxisWheel,
  CHART_SCALE_OPTIONS,
  focusedLogicalRange,
  fullLogicalRange,
  resetChartView,
  resetPriceScale,
  type ChartViewApi,
} from "@/lib/charts/interact";
import type { ChartOverlay } from "@/lib/charts/overlay";
import type { CandleBar } from "@/lib/market/candles";

const CHART_ICON = { size: 16, className: "size-4" } as const;

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
        {copied ? <IconCheck {...CHART_ICON} /> : <IconCopy {...CHART_ICON} />}
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
        <IconCamera {...CHART_ICON} />
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
  rightOffset = 12,
  toolbar,
  toolbarCenter,
  status = null,
  visibleRange = null,
  viewKey = 0,
}: {
  candles: CandleBar[];
  overlay: ChartOverlay;
  height?: number;
  screenshotName?: string;
  rightOffset?: number;
  toolbar?: ReactNode;
  toolbarCenter?: ReactNode;
  status?: string | null;
  visibleRange?: { fromSec: number; toSec: number } | null;
  viewKey?: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ChartHandle | null>(null);
  const viewRef = useRef<ChartViewApi | null>(null);
  const padEdgesRef = useRef<(() => void) | null>(null);
  const [menu, setMenu] = useState<ChartContextMenuState>(null);
  const [expanded, setExpanded] = useState(false);
  const [monitorFull, setMonitorFull] = useState(false);
  const [viewportH, setViewportH] = useState(0);
  const fillViewport = expanded || monitorFull;
  const frameHeight =
    fillViewport && viewportH > CHART_TOOLBAR_H ? viewportH : height;
  const plotHeight = frameHeight - CHART_TOOLBAR_H;

  useEffect(() => {
    function syncFs() {
      const node = frameRef.current;
      const on = node != null && monitorFullscreenElement() === node;
      setMonitorFull(on);
      if (on) {
        setViewportH(window.innerHeight);
      }
    }
    document.addEventListener("fullscreenchange", syncFs);
    document.addEventListener("webkitfullscreenchange", syncFs);
    return () => {
      document.removeEventListener("fullscreenchange", syncFs);
      document.removeEventListener("webkitfullscreenchange", syncFs);
    };
  }, []);

  useEffect(() => {
    if (!expanded && !monitorFull) {
      return;
    }
    function sync() {
      setViewportH(window.innerHeight);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      if (monitorFullscreenElement()) {
        return;
      }
      setExpanded(false);
    }
    sync();
    const previousOverflow = document.body.style.overflow;
    if (expanded && !monitorFull) {
      document.body.style.overflow = "hidden";
    }
    window.addEventListener("resize", sync);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("resize", sync);
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded, monitorFull]);

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
        rightPriceScale: {
          borderColor: "#2A313C",
          scaleMargins: { top: 0.16, bottom: 0.14 },
        },
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
        lastValueVisible: overlay.lines.length === 0,
        priceLineVisible: overlay.lines.length === 0,
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
      const times = candles.map((row) => Math.floor(row.timeMs / 1000));
      function applyView() {
        const logical =
          visibleRange && visibleRange.toSec >= visibleRange.fromSec
            ? focusedLogicalRange(
                times,
                visibleRange.fromSec,
                visibleRange.toSec,
              )
            : fullLogicalRange(candles.length);
        if (logical) {
          chart.timeScale().setVisibleLogicalRange(logical);
          return;
        }
        chart.timeScale().fitContent();
      }
      applyView();
      padEdgesRef.current = applyView;
      const detachWheel = attachRightAxisWheel(host, () => viewRef.current);
      const observer = new ResizeObserver(() => {
        if (hostRef.current) {
          chart.applyOptions({
            width: hostRef.current.clientWidth,
            height: hostRef.current.clientHeight,
          });
        }
      });
      observer.observe(host);
      cleanup = () => {
        detachWheel();
        observer.disconnect();
        padEdgesRef.current = null;
        chartRef.current = null;
        viewRef.current = null;
        chart.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [candles, overlay, plotHeight, rightOffset, visibleRange, viewKey]);

  const frame = (
    <div
      ref={frameRef}
      className={
        expanded && !monitorFull
          ? "desk-chart-frame fixed inset-0 z-50 flex h-dvh w-full flex-col bg-canvas"
          : monitorFull
            ? "desk-chart-frame flex h-full w-full flex-col bg-canvas"
            : "desk-chart-frame flex w-full flex-col overflow-hidden rounded-card border border-line bg-canvas"
      }
      style={fillViewport ? undefined : { height }}
    >
      <div className="grid min-h-9 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-line px-1.5 py-1">
        <div className="min-w-0">{toolbar}</div>
        <div className="flex min-w-0 justify-center">{toolbarCenter}</div>
        <div className="flex items-center gap-0.5">
          {monitorFull ? null : (
            <button
              type="button"
              title={expanded ? "Exit browser fill" : "Fill browser"}
              aria-label={expanded ? "Exit browser fill" : "Fill browser"}
              aria-pressed={expanded}
              className={SHOT_BUTTON}
              onClick={() => {
                if (expanded) {
                  setExpanded(false);
                  return;
                }
                setViewportH(window.innerHeight);
                setExpanded(true);
              }}
            >
              {expanded ? <IconCollapse {...CHART_ICON} /> : <IconExpand {...CHART_ICON} />}
            </button>
          )}
          <button
            type="button"
            title={monitorFull ? "Exit full screen" : "Full screen"}
            aria-label={monitorFull ? "Exit full screen" : "Full screen"}
            aria-pressed={monitorFull}
            className={SHOT_BUTTON}
            onClick={() => {
              const node = frameRef.current;
              if (!node) {
                return;
              }
              if (monitorFullscreenElement() === node) {
                void exitMonitorFullscreen();
                return;
              }
              setViewportH(window.innerHeight);
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
            {monitorFull ? <IconExitMonitor {...CHART_ICON} /> : <IconMonitor {...CHART_ICON} />}
          </button>
          <ChartScreenshotControls
            getChart={() => chartRef.current}
            filename={screenshotName}
          />
        </div>
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
            padEdgesRef.current?.();
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

  if (expanded && typeof document !== "undefined") {
    return (
      <>
        <div className="w-full" style={{ height }} aria-hidden />
        {createPortal(frame, document.body)}
      </>
    );
  }
  return frame;
}
