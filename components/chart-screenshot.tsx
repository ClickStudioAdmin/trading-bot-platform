"use client";

import { useEffect, useState } from "react";
import { IconCamera, IconCheck, IconCopy } from "@/components/icons";

const CHART_ICON = { size: 16, className: "size-4" } as const;
const SHOT_BUTTON =
  "inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink";

export type ChartSnapshot = {
  takeScreenshot: (
    addTopLayer?: boolean,
    includeCrosshair?: boolean,
  ) => HTMLCanvasElement;
};

function captureChartPng(chart: ChartSnapshot): Promise<Blob> {
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

export function downloadChartScreenshot(chart: ChartSnapshot, filename: string) {
  void captureChartPng(chart).then((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  });
}

export async function copyChartScreenshot(chart: ChartSnapshot): Promise<boolean> {
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

export function ChartScreenshotControls({
  getChart,
  filename,
  className,
}: {
  getChart: () => ChartSnapshot | null;
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
        title={copied ? "Copied" : copyFailed ? "Could not copy" : "Copy snapshot"}
        aria-label={copied ? "Copied" : copyFailed ? "Could not copy" : "Copy snapshot"}
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
