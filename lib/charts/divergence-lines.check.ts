import assert from "node:assert/strict";
import type { ISeriesPrimitive, SeriesAttachedParameter, Time } from "lightweight-charts";
import { DivergenceLinesPrimitive, releaseDivergenceLines } from "./divergence-lines";

type Host = {
  detachPrimitive: (primitive: ISeriesPrimitive<Time>) => void;
};

function host(): Host & { detached: DivergenceLinesPrimitive[] } {
  const detached: DivergenceLinesPrimitive[] = [];
  return {
    detached,
    detachPrimitive(primitive) {
      detached.push(primitive as DivergenceLinesPrimitive);
      (primitive as DivergenceLinesPrimitive).detached();
    },
  };
}

const candle = host();
const rsiHost = host();
const price = new DivergenceLinesPrimitive();
const rsi = new DivergenceLinesPrimitive();
const attached = {
  chart: {},
  requestUpdate: () => {},
} as SeriesAttachedParameter<Time>;
price.attached({
  ...attached,
  series: candle as unknown as SeriesAttachedParameter<Time>["series"],
});
rsi.attached({
  ...attached,
  series: rsiHost as unknown as SeriesAttachedParameter<Time>["series"],
});
price.setSegments([
  {
    olderTime: 1,
    newerTime: 2,
    olderValue: 10,
    newerValue: 12,
    color: "#34D399",
    marker: null,
  },
]);

releaseDivergenceLines(candle, price, rsi);

assert.deepEqual(candle.detached, [price]);
assert.deepEqual(rsiHost.detached, [rsi]);
assert.equal(price.segments().length, 0);
assert.equal(price.series(), null);
assert.equal(rsi.series(), null);

releaseDivergenceLines(candle, null, rsi);
assert.equal(candle.detached.length, 1);
assert.equal(rsiHost.detached.length, 1);

console.log("divergence line release checks passed");
