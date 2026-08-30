import type { BacktestRun, EquityPoint } from "./model";

export function buildEquityTimeline(run: BacktestRun): EquityPoint[] {
  const points: EquityPoint[] = [
    {
      atMs: run.fromMs,
      equityUsdt: run.startingUsdt,
      realizedUsdt: 0,
      label: "Start",
    },
  ];
  let realized = 0;
  for (const order of run.orders) {
    if (order.realizedUsdt != null) {
      realized += order.realizedUsdt;
    }
    points.push({
      atMs: order.atMs,
      equityUsdt: run.startingUsdt + realized,
      realizedUsdt: realized,
      label: `${order.action} ${order.side}`,
    });
  }
  const ending = run.stats?.endingUsdt;
  const last = points[points.length - 1];
  if (
    ending != null &&
    last &&
    (Math.abs(ending - last.equityUsdt) > 1e-6 || run.toMs > last.atMs)
  ) {
    points.push({
      atMs: run.toMs,
      equityUsdt: ending,
      realizedUsdt: run.stats?.realizedUsdt ?? realized,
      label: run.stats?.openSide ? "Mark" : "End",
    });
  }
  return points;
}

export { recipeParamRows } from "./library";
