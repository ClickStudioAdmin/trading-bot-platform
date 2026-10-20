import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

export type ConditionOrderMark = {
  price: number;
  title: string;
};

type MarkStyle = {
  badge: string;
  text: string;
};

const LABEL_HEIGHT = 16;
const LABEL_GAP = 2;

/**
 * Draws condition-order names on the left of the price pane. The dotted line
 * stays a price line on the candles, with its own axis tag hidden.
 */
export class ConditionOrderMarks implements ISeriesPrimitive<Time> {
  private chartHandle: SeriesAttachedParameter<Time>["chart"] | null = null;
  private seriesHandle: SeriesAttachedParameter<Time>["series"] | null = null;
  private requestUpdate: () => void = () => {};
  private marks: ConditionOrderMark[] = [];
  private style: MarkStyle = { badge: "#9AA3B2", text: "#0B0E14" };
  private readonly renderer = new ConditionOrderMarksRenderer(this);
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

  setMarks(marks: readonly ConditionOrderMark[]) {
    this.marks = marks.slice();
    this.requestUpdate();
  }

  setStyle(style: MarkStyle) {
    this.style = style;
    this.requestUpdate();
  }

  chart() {
    return this.chartHandle;
  }

  series() {
    return this.seriesHandle;
  }

  rows() {
    return this.marks;
  }

  paint() {
    return this.style;
  }
}

class ConditionOrderMarksRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly owner: ConditionOrderMarks) {}

  draw(target: CanvasRenderingTarget2D) {
    const series = this.owner.series();
    const marks = this.owner.rows();
    if (!series || marks.length === 0) {
      return;
    }
    const formatter = series.priceFormatter();
    const placed: Array<{ y: number; text: string }> = [];
    for (const mark of marks) {
      const y = series.priceToCoordinate(mark.price);
      if (y == null || !Number.isFinite(y)) {
        continue;
      }
      placed.push({ y, text: `${mark.title} ${formatter.format(mark.price)}` });
    }
    placed.sort((left, right) => left.y - right.y);
    let floor = Number.NEGATIVE_INFINITY;
    for (const row of placed) {
      if (row.y < floor) {
        row.y = floor;
      }
      floor = row.y + LABEL_HEIGHT + LABEL_GAP;
    }
    const { badge, text } = this.owner.paint();
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.font = "600 11px sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      for (const row of placed) {
        const width = Math.ceil(ctx.measureText(row.text).width);
        const left = 6;
        const pad = 5;
        const top = Math.round(row.y - LABEL_HEIGHT / 2);
        ctx.beginPath();
        ctx.roundRect(left, top, width + pad * 2, LABEL_HEIGHT, 3);
        ctx.fillStyle = badge;
        ctx.fill();
        ctx.fillStyle = text;
        ctx.fillText(row.text, left + pad, top + LABEL_HEIGHT / 2);
      }
    });
  }
}
