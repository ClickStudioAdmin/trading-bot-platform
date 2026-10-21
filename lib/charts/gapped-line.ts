import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
  UTCTimestamp,
} from "lightweight-charts";

export type GappedLinePoint = { time: number; value: number };

export type GappedLineStyleSource = {
  options: () => { color?: string; lineWidth?: number; visible?: boolean };
};

type ChartHandle = SeriesAttachedParameter<Time>["chart"];
type SeriesHandle = SeriesAttachedParameter<Time>["series"];

/**
 * Contiguous runs of a line that is blank between them.
 * Lightweight Charts joins the last point of a run to the next one, so a
 * bullish Supertrend stretch is stroked straight through the bearish stretch.
 * These runs are drawn separately.
 */
export function gappedLineRuns(
  candles: readonly { timeMs: number }[],
  values: readonly (number | null)[],
  through = candles.length - 1,
): GappedLinePoint[][] {
  const runs: GappedLinePoint[][] = [];
  let run: GappedLinePoint[] = [];
  const end = Math.min(through, candles.length - 1, values.length - 1);
  for (let i = 0; i <= end; i += 1) {
    const timeMs = candles[i]?.timeMs;
    const value = values[i];
    if (!(timeMs != null && timeMs > 0)) {
      continue;
    }
    if (value == null || !Number.isFinite(value)) {
      if (run.length > 0) {
        runs.push(run);
        run = [];
      }
      continue;
    }
    run.push({ time: Math.floor(timeMs / 1000), value });
  }
  if (run.length > 0) {
    runs.push(run);
  }
  return runs;
}

/**
 * Draws each run on its own. Attach this to the candle series so price
 * coordinates use the candle scale. The library line stays hidden.
 */
export class GappedLinePrimitive implements ISeriesPrimitive<Time> {
  private chartHandle: ChartHandle | null = null;
  private seriesHandle: SeriesHandle | null = null;
  private requestUpdate: () => void = () => {};
  private runs: GappedLinePoint[][] = [];
  private styleSource: GappedLineStyleSource | null = null;
  private readonly renderer = new GappedLineRenderer(this);
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

  setStyleSource(source: GappedLineStyleSource) {
    this.styleSource = source;
  }

  setRuns(runs: readonly (readonly GappedLinePoint[])[]) {
    this.runs = runs.map((run) => run.slice());
    this.requestUpdate();
  }

  chart() {
    return this.chartHandle;
  }

  series() {
    return this.seriesHandle;
  }

  segments() {
    return this.runs;
  }

  style(): { color: string; lineWidth: number; visible: boolean } {
    const options = this.styleSource?.options();
    const width = options?.lineWidth;
    return {
      color: options?.color || "#34D399",
      lineWidth: width === 1 || width === 2 || width === 3 ? width : 2,
      visible: options?.visible !== false,
    };
  }
}

class GappedLineRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly owner: GappedLinePrimitive) {}

  draw(target: CanvasRenderingTarget2D) {
    const chart = this.owner.chart();
    const series = this.owner.series();
    const runs = this.owner.segments();
    const style = this.owner.style();
    if (!chart || !series || !style.visible || runs.length === 0) {
      return;
    }
    const barSpacing = chart.timeScale().options().barSpacing;
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const horizontal = scope.horizontalPixelRatio;
      const vertical = scope.verticalPixelRatio;
      ctx.lineCap = "butt";
      ctx.lineJoin = "round";
      ctx.lineWidth = style.lineWidth * vertical;
      ctx.strokeStyle = style.color;
      const half = Math.max(barSpacing, 1) * horizontal * 0.5;
      for (const run of runs) {
        const points: Array<{ x: number; y: number }> = [];
        for (const point of run) {
          const x = chart.timeScale().timeToCoordinate(point.time as UTCTimestamp);
          const y = series.priceToCoordinate(point.value);
          if (x == null || y == null) {
            continue;
          }
          points.push({ x: x * horizontal, y: y * vertical });
        }
        if (points.length === 0) {
          continue;
        }
        ctx.beginPath();
        if (points.length === 1) {
          const only = points[0];
          if (!only) {
            continue;
          }
          ctx.moveTo(only.x - half, only.y);
          ctx.lineTo(only.x + half, only.y);
        } else {
          const first = points[0];
          if (!first) {
            continue;
          }
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < points.length; i += 1) {
            const next = points[i];
            if (next) {
              ctx.lineTo(next.x, next.y);
            }
          }
        }
        ctx.stroke();
      }
    });
  }
}
