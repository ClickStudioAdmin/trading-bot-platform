import assert from "node:assert/strict";
import {
  BYBIT_AGREEMENT_NOTE,
  isBybitAgreementQuiet,
  isBybitAgreementReject,
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

console.log("agreement checks passed");
