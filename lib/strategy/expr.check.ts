import assert from "node:assert/strict";
import type { DcaFilterSpec } from "@/lib/dca/filters";
import {
  confirmFromEntryStack,
  emptyEntryStack,
  entryStackError,
  entryStackFromJson,
  entryStackIsLegacy,
  entryStackMet,
  entryStackToJson,
  formatEntryWithStack,
  legacyEntryStack,
  resolveEntryStack,
  STRATEGY_CONDITION_CAP,
} from "./expr";

const rsi: DcaFilterSpec = {
  kind: "rsi",
  timeframe: "15",
  compare: "lte",
  level: 30,
  period: 14,
  multiplier: null,
};
const ema: DcaFilterSpec = {
  kind: "ema",
  timeframe: "60",
  compare: "gte",
  level: null,
  period: 21,
  multiplier: null,
};
const sma: DcaFilterSpec = {
  kind: "sma",
  timeframe: "240",
  compare: "gte",
  level: null,
  period: 21,
  multiplier: null,
};
const bb: DcaFilterSpec = {
  kind: "bb",
  timeframe: "D",
  compare: "inside",
  level: null,
  period: 20,
  multiplier: null,
};

assert.equal(
  entryStackMet({ trigger: true, leaves: [], joins: [] }),
  true,
);
assert.equal(
  entryStackMet({ trigger: false, leaves: [], joins: [] }),
  false,
);

const oneAnd = legacyEntryStack(rsi);
assert.equal(confirmFromEntryStack(oneAnd)?.kind, "rsi");
assert.equal(entryStackIsLegacy(oneAnd), true);
assert.equal(
  entryStackMet({ trigger: true, leaves: [true], joins: ["and"] }),
  true,
);
assert.equal(
  entryStackMet({ trigger: true, leaves: [false], joins: ["and"] }),
  false,
);
assert.equal(
  entryStackMet({ trigger: false, leaves: [true], joins: ["and"] }),
  false,
);

assert.equal(
  entryStackMet({ trigger: false, leaves: [true], joins: ["or"] }),
  true,
);
assert.equal(
  entryStackMet({ trigger: false, leaves: [false], joins: ["or"] }),
  false,
);

assert.equal(
  entryStackMet({
    trigger: false,
    leaves: [false, true],
    joins: ["and", "or"],
  }),
  true,
  "trigger AND miss OR hit",
);
assert.equal(
  entryStackMet({
    trigger: true,
    leaves: [false, true],
    joins: ["and", "or"],
  }),
  true,
  "the Or group can pass on its own",
);
assert.equal(
  entryStackMet({
    trigger: false,
    leaves: [true, false],
    joins: ["or", "and"],
  }),
  false,
  "Or starts a group and the following And stays inside it",
);
assert.equal(
  entryStackMet({
    trigger: false,
    leaves: [true, true],
    joins: ["or", "and"],
  }),
  true,
);

assert.equal(resolveEntryStack(undefined, rsi).leaves.length, 1);
assert.equal(resolveEntryStack(emptyEntryStack(), rsi).leaves.length, 0);
assert.equal(resolveEntryStack(null, null).leaves.length, 0);

const roundTrip = entryStackFromJson(
  entryStackToJson({
    leaves: [
      { kind: "filter", spec: rsi },
      { kind: "filter", spec: ema },
    ],
    joins: ["and", "or"],
  }),
);
assert.equal(roundTrip?.joins[1], "or");
assert.equal(roundTrip?.leaves[1]?.spec.kind, "ema");
assert.equal(entryStackFromJson({ leaves: [], joins: ["and"] }), null);
assert.equal(entryStackFromJson({ leaves: [{ kind: "price" }], joins: ["and"] }), null);

const tooMany = {
  leaves: Array.from({ length: STRATEGY_CONDITION_CAP }, () => ({
    kind: "filter" as const,
    spec: rsi,
  })),
  joins: Array.from({ length: STRATEGY_CONDITION_CAP }, () => "and" as const),
};
assert.match(
  entryStackError({ stack: tooMany }) ?? "",
  /12 entry conditions/,
);

assert.match(
  entryStackError({
    stack: {
      leaves: [
        { kind: "filter", spec: rsi },
        { kind: "filter", spec: ema },
        { kind: "filter", spec: sma },
        { kind: "filter", spec: bb },
      ],
      joins: ["and", "and", "and", "or"],
    },
    triggerTimeframe: "5",
  }) ?? "",
  /4 timeframes/,
);

assert.equal(
  formatEntryWithStack(
    "Price",
    {
      leaves: [
        { kind: "filter", spec: rsi },
        { kind: "filter", spec: ema },
      ],
      joins: ["and", "or"],
    },
    (spec) => spec.kind,
  ),
  "Price, and rsi, or ema",
);

console.log("strategy expr checks passed");
