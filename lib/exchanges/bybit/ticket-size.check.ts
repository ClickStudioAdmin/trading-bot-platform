import assert from "node:assert/strict";
import { formatPerpMinQty, perpEffectiveMaxQty, perpTicketLimitError, perpTicketSizeError } from "./ticket-size";

assert.equal(formatPerpMinQty(0.001), "0.001");
assert.equal(formatPerpMinQty(5), "5");
assert.equal(formatPerpMinQty(4_600_000_000_000), "4,600,000,000,000");

assert.equal(
  perpEffectiveMaxQty({ maxQty: 100, maxMktQty: 40, orderType: "market" }),
  40,
);
assert.equal(
  perpEffectiveMaxQty({ maxQty: 100, maxMktQty: 40, orderType: "limit" }),
  100,
);

assert.equal(
  perpTicketSizeError({
    size: "",
    unit: "qty",
    minQty: 0.001,
    minNotional: 5,
    baseCoin: "BTC",
  }),
  null,
);

assert.equal(
  perpTicketSizeError({
    size: "0.0004",
    unit: "qty",
    minQty: 0.001,
    minNotional: 5,
    baseCoin: "BTC",
  }),
  "Minimum size is 0.001 BTC.",
);

assert.equal(
  perpTicketSizeError({
    size: "0.001",
    unit: "qty",
    minQty: 0.001,
    minNotional: 5,
    lastPrice: 50_000,
    baseCoin: "BTC",
  }),
  null,
);

assert.equal(
  perpTicketSizeError({
    size: "50",
    unit: "usdt",
    minQty: 0.001,
    minNotional: 5,
    lastPrice: 100_000,
    baseCoin: "BTC",
  }),
  "Minimum order is $100 (0.001 BTC).",
);

assert.equal(
  perpTicketSizeError({
    size: "1",
    unit: "usdt",
    minQty: 0.001,
    minNotional: 5,
    baseCoin: "BTC",
  }),
  "Minimum order value is $5.",
);

assert.equal(
  perpTicketSizeError({
    size: "0.001",
    unit: "qty",
    minQty: 0.001,
    minNotional: 5,
    lastPrice: 1,
    baseCoin: "DOGE",
  }),
  "Minimum order value is $5.",
);

assert.equal(
  perpTicketSizeError({
    size: "5000000000000",
    unit: "qty",
    minQty: 1,
    maxQty: 4_600_000_000_000,
    minNotional: 0,
    baseCoin: "1INCH",
  }),
  "Maximum size is 4,600,000,000,000 1INCH.",
);

assert.equal(
  perpTicketSizeError({
    size: "4600000000000",
    unit: "qty",
    minQty: 1,
    maxQty: 4_600_000_000_000,
    minNotional: 0,
    baseCoin: "1INCH",
  }),
  null,
);

assert.equal(
  perpTicketSizeError({
    size: "100000",
    unit: "usdt",
    minQty: 0.001,
    maxQty: 1,
    minNotional: 5,
    lastPrice: 50_000,
    orderType: "market",
    baseCoin: "BTC",
  }),
  "Maximum size is 1 BTC.",
);

assert.equal(
  perpTicketLimitError({
    limitPrice: "",
    minPrice: 0.1,
    tickSize: 0.1,
  }),
  null,
);

assert.equal(
  perpTicketLimitError({
    limitPrice: "0.01",
    minPrice: 0.1,
    tickSize: 0.1,
  }),
  "Minimum limit is $0.1.",
);

assert.equal(
  perpTicketLimitError({
    limitPrice: "40,000",
    minPrice: 0.1,
    tickSize: 0.1,
  }),
  null,
);

console.log("perp ticket size checks passed");
