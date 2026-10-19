import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
  UTCTimestamp,
} from "lightweight-charts";

export type DivergenceDrawSegment = {
  olderTime: number;
  newerTime: number;
  olderValue: number;
  newerValue: number;
  color: string;
  /** Triangle at each swing. Price lines leave this empty. */
  marker: "up" | "down" | null;
};

type ChartHandle = SeriesAttachedParameter<Time>["chart"];
type SeriesHandle = SeriesAttachedParameter<Time>["series"];

/**
 * Draws divergence segments on the series pane. One primitive on the candle
 * series paints price. One on the RSI series paints the oscillator and triangles.
 */
export class DivergenceLinesPrimitive implements ISeriesPrimitive<Time> {
  private chartHandle: ChartHandle | null = null;
  private seriesHandle: SeriesHandle | null = null;
  private requestUpdate: () => void = () => {};
  private drawSegments: DivergenceDrawSegment[] = [];
  private readonly renderer = new DivergenceLinesRenderer(this);
  private readonly views: readonly IPrimitivePaneView[] = [
    {
      zOrder: () => "top",
      renderer: () => this.renderer,
    },
  ];

  attached(param: SeriesAttachedParameter<Time>) {
    this.chartHandle = param.chart;
    this.seriesHandle = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached() {
    this.chartHandle = null;
    this.seriesHandle = null;
  }

  paneViews() {
    return this.views;
  }

  updateAllViews() {}

  setSegments(segments: readonly DivergenceDrawSegment[]) {
    this.drawSegments = segments.slice();
    this.requestUpdate();
  }

  segments() {
    return this.drawSegments;
  }

  chart() {
    return this.chartHandle;
  }

  series() {
    return this.seriesHandle;
  }
}

class DivergenceLinesRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly owner: DivergenceLinesPrimitive) {}

  draw(target: CanvasRenderingTarget2D) {
    const chart = this.owner.chart();
    const series = this.owner.series();
    const segments = this.owner.segments();
    if (!chart || !series || segments.length === 0) {
      return;
    }
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const horizontal = scope.horizontalPixelRatio;
      const vertical = scope.verticalPixelRatio;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(horizontal, Math.round(2 * horizontal));
      const markers: Array<{
        x: number;
        y: number;
        marker: "up" | "down";
        color: string;
      }> = [];
      const seen = new Set<string>();
      for (const segment of segments) {
        const x1 = chart.timeScale().timeToCoordinate(segment.olderTime as UTCTimestamp);
        const x2 = chart.timeScale().timeToCoordinate(segment.newerTime as UTCTimestamp);
        const y1 = series.priceToCoordinate(segment.olderValue);
        const y2 = series.priceToCoordinate(segment.newerValue);
        if (x1 == null || x2 == null || y1 == null || y2 == null) {
          continue;
        }
        const left = x1 * horizontal;
        const right = x2 * horizontal;
        const top = y1 * vertical;
        const bottom = y2 * vertical;
        ctx.beginPath();
        ctx.strokeStyle = segment.color;
        ctx.moveTo(left, top);
        ctx.lineTo(right, bottom);
        ctx.stroke();
        if (segment.marker) {
          rememberMarker(markers, seen, left, top, segment.marker, segment.color);
          rememberMarker(markers, seen, right, bottom, segment.marker, segment.color);
        }
      }
      for (const marker of markers) {
        drawTriangle(ctx, marker.x, marker.y, marker.marker, marker.color, vertical);
      }
    });
  }
}

function rememberMarker(
  markers: Array<{ x: number; y: number; marker: "up" | "down"; color: string }>,
  seen: Set<string>,
  x: number,
  y: number,
  marker: "up" | "down",
  color: string,
) {
  const key = `${Math.round(x)}:${Math.round(y)}:${marker}:${color}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  markers.push({ x, y, marker, color });
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  marker: "up" | "down",
  color: string,
  ratio: number,
) {
  const height = 8 * ratio;
  const half = 5 * ratio;
  ctx.beginPath();
  ctx.fillStyle = color;
  if (marker === "up") {
    ctx.moveTo(x, y);
    ctx.lineTo(x - half, y + height);
    ctx.lineTo(x + half, y + height);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x - half, y - height);
    ctx.lineTo(x + half, y - height);
  }
  ctx.closePath();
  ctx.fill();
}
