import assert from "node:assert/strict";
import {
  BYBIT_AGREEMENT_NOTE,
  bybitAgreementKind,
  firstOpenPerp,
  isBybitAgreementQuiet,
  isBybitAgreementReject,
  perpNeedsBybitAgreement,
  symbolNeedsBybitAgreement,
} from "./agreement";

assert.equal(
  isBybitAgreementReject(
    "Bybit rejected that order: You must sign the required agreement before trading this contract.",
  ),
  true,
);
assert.equal(
  isBybitAgreementReject(
    "Bybit rejected that order: You must agree to the Crude Oil Trading Terms before trading this contract.",
  ),
  true,
);
assert.equal(
  isBybitAgreementReject("Bybit rejected that order: insufficient balance."),
  false,
);
assert.equal(isBybitAgreementReject(BYBIT_AGREEMENT_NOTE), false);
assert.equal(isBybitAgreementQuiet(BYBIT_AGREEMENT_NOTE), true);
assert.equal(
  isBybitAgreementQuiet(
    "Bybit rejected that order: You must sign the required agreement before trading this contract.",
  ),
  false,
);
assert.equal(symbolNeedsBybitAgreement(["CLUSDT"], "clusdt"), true);
assert.equal(symbolNeedsBybitAgreement(["CLUSDT"], "BTCUSDT"), false);
assert.equal(symbolNeedsBybitAgreement(undefined, "CLUSDT"), false);
assert.equal(bybitAgreementKind({ symbolType: "stock", baseCoin: "TSLA" }), "tradfi");
assert.equal(bybitAgreementKind({ symbolType: "commodity", baseCoin: "XAU" }), "tradfi");
assert.equal(bybitAgreementKind({ symbolType: "commodity", baseCoin: "CL" }), "oil");
assert.equal(bybitAgreementKind({ symbolType: "", baseCoin: "BTC" }), null);
const gate = { symbols: ["OKLOUSDT"], cleared: ["tradfi"] as const, live: true };
assert.equal(
  perpNeedsBybitAgreement(gate, {
    symbol: "TSLAUSDT",
    symbolType: "stock",
    baseCoin: "TSLA",
  }),
  false,
);
assert.equal(
  perpNeedsBybitAgreement(
    { symbols: [], cleared: [], live: true },
    { symbol: "COINUSDT", symbolType: "stock", baseCoin: "COIN" },
  ),
  true,
);
assert.equal(
  perpNeedsBybitAgreement(gate, {
    symbol: "OKLOUSDT",
    symbolType: "",
    baseCoin: "OKLO",
  }),
  true,
);
assert.equal(
  firstOpenPerp(
    [
      { symbol: "COINUSDT", symbolType: "stock", baseCoin: "COIN" },
      { symbol: "BTCUSDT", symbolType: "", baseCoin: "BTC" },
    ],
    { symbols: [], cleared: [], live: true },
    "COINUSDT",
  ),
  "BTCUSDT",
);

console.log("agreement checks passed");
