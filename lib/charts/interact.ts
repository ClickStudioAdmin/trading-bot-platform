export type PriceRange = { from: number; to: number };

export const CHART_EDGE_PAD = { left: 8, right: 12 } as const;

export function padLogicalRange(
  range: { from: number; to: number } | null,
  left = CHART_EDGE_PAD.left,
  right = CHART_EDGE_PAD.right,
): { from: number; to: number } | null {
  if (!range || !(range.to > range.from) || !(left >= 0) || !(right >= 0)) {
    return null;
  }
  return {
    from: range.from - left,
    to: range.to + right,
  };
}

export function fullLogicalRange(
  barCount: number,
  left = CHART_EDGE_PAD.left,
  right = CHART_EDGE_PAD.right,
): { from: number; to: number } | null {
  if (!(barCount > 0)) {
    return null;
  }
  return {
    from: -left,
    to: barCount - 1 + right,
  };
}

export function focusedLogicalRange(
  times: number[],
  fromSec: number,
  toSec: number,
  left = CHART_EDGE_PAD.left,
  right = CHART_EDGE_PAD.right,
): { from: number; to: number } | null {
  if (times.length === 0) {
    return null;
  }
  let start = 0;
  let end = 0;
  for (let i = 0; i < times.length; i += 1) {
    const time = times[i] ?? 0;
    if (time <= fromSec) {
      start = i;
    }
    if (time <= toSec) {
      end = i;
    }
  }
  const hi = Math.max(end, start + 1);
  return {
    from: start - left,
    to: hi + right,
  };
}

export type PriceScaleApi = {
  width: () => number;
  getVisibleRange: () => PriceRange | null;
  setVisibleRange: (range: PriceRange) => void;
  setAutoScale: (on: boolean) => void;
};

export type ChartPaneView = {
  getHTMLElement: () => HTMLElement | null;
  priceScale: (id: string) => PriceScaleApi;
};

export type ChartViewApi = {
  timeScale: () => { fitContent: () => void };
  priceScale: (id: string) => PriceScaleApi;
  panes?: () => ChartPaneView[];
};

export type VerticalBand = { top: number; bottom: number };

/** Pane under the pointer, or null when the pointer is on the time axis. */
export function paneIndexAtY(bands: VerticalBand[], clientY: number): number | null {
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    if (band && clientY >= band.top && clientY <= band.bottom) {
      return index;
    }
  }
  return null;
}

export function zoomPriceRange(
  range: PriceRange,
  factor: number,
  anchorRatio: number,
): PriceRange | null {
  if (!(range.to > range.from) || !(factor > 0) || !Number.isFinite(factor)) {
    return null;
  }
  const span = range.to - range.from;
  const next = span * factor;
  if (!(next > 0) || !Number.isFinite(next)) {
    return null;
  }
  const ratio = Math.min(1, Math.max(0, anchorRatio));
  const anchor = range.from + span * ratio;
  return {
    from: anchor - next * ratio,
    to: anchor + next * (1 - ratio),
  };
}

export function wheelZoomFactor(deltaY: number): number {
  const clamped = Math.max(-80, Math.min(80, deltaY));
  return Math.exp(clamped * 0.0025);
}

export function isOverRightPriceScale(
  host: HTMLElement,
  axisWidth: number,
  clientX: number,
): boolean {
  if (!(axisWidth > 0)) {
    return false;
  }
  const rect = host.getBoundingClientRect();
  return clientX >= rect.right - axisWidth && clientX <= rect.right;
}

export function resetChartView(chart: ChartViewApi): void {
  chart.priceScale("right").setAutoScale(true);
  chart.timeScale().fitContent();
}

export function resetPriceScale(chart: ChartViewApi): void {
  chart.priceScale("right").setAutoScale(true);
}

function rightScaleAtPointer(
  chart: ChartViewApi,
  host: HTMLElement,
  event: WheelEvent,
): { scale: PriceScaleApi; top: number; bottom: number } | null {
  const panes = chart.panes?.() ?? [];
  const bands = panes.map((pane) => {
    const box = pane.getHTMLElement()?.getBoundingClientRect();
    return box ? { top: box.top, bottom: box.bottom, pane } : null;
  });
  if (bands.some((band) => band != null)) {
    const index = paneIndexAtY(
      bands.map((band) => band ?? { top: Number.NaN, bottom: Number.NaN }),
      event.clientY,
    );
    const hit = index == null ? null : bands[index];
    if (!hit) {
      return null;
    }
    const scale = hit.pane.priceScale("right");
    if (!isOverRightPriceScale(host, scale.width(), event.clientX)) {
      return null;
    }
    return { scale, top: hit.top, bottom: hit.bottom };
  }
  const scale = chart.priceScale("right");
  if (!isOverRightPriceScale(host, scale.width(), event.clientX)) {
    return null;
  }
  const rect = host.getBoundingClientRect();
  return { scale, top: rect.top, bottom: rect.bottom };
}

export function attachRightAxisWheel(
  host: HTMLElement,
  getChart: () => ChartViewApi | null,
): () => void {
  function onWheel(event: WheelEvent) {
    const chart = getChart();
    if (!chart) {
      return;
    }
    const hit = rightScaleAtPointer(chart, host, event);
    if (!hit) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.deltaY === 0) {
      return;
    }
    const range = hit.scale.getVisibleRange();
    if (!range) {
      return;
    }
    const height = hit.bottom - hit.top;
    const ratio = height > 0 ? (hit.bottom - event.clientY) / height : 0.5;
    const next = zoomPriceRange(range, wheelZoomFactor(event.deltaY), ratio);
    if (!next) {
      return;
    }
    hit.scale.setAutoScale(false);
    hit.scale.setVisibleRange(next);
  }
  host.addEventListener("wheel", onWheel, { passive: false, capture: true });
  return () =>
    host.removeEventListener("wheel", onWheel, { capture: true });
}

export const CHART_SCALE_OPTIONS = {
  handleScale: {
    mouseWheel: true,
    pinch: true,
    axisPressedMouseMove: { time: true, price: true },
    axisDoubleClickReset: { time: true, price: true },
  },
  handleScroll: {
    mouseWheel: true,
    pressedMouseMove: true,
    horzTouchDrag: true,
    vertTouchDrag: true,
  },
} as const;
