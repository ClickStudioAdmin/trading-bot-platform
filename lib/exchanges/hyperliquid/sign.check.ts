import assert from "node:assert/strict";
import { createL1ActionHash, signL1Action } from "./sign";

const L1_ACTION = {
  type: "order",
  orders: [
    {
      a: 0,
      b: true,
      p: "30000",
      s: "0.1",
      r: false,
      t: { limit: { tif: "Gtc" } },
    },
  ],
  grouping: "na",
};
const NONCE = 1234567890;
const VAULT = "0x1234567890123456789012345678901234567890";
const KEY = "0x822e9959e022b78423eb653a62ea0020cd283e71a2a8133a6ff2aeffaf373cff";

assert.equal(
  createL1ActionHash({ action: L1_ACTION, nonce: NONCE }),
  "0x25367e0dba84351148288c2233cd6130ed6cec5967ded0c0b7334f36f957cc90",
);
assert.equal(
  createL1ActionHash({
    action: L1_ACTION,
    nonce: NONCE,
    vaultAddress: VAULT,
  }),
  "0x214e2ea3270981b6fd18174216691e69f56872663139d396b10ded319cb4bb1e",
);
assert.equal(
  createL1ActionHash({
    action: L1_ACTION,
    nonce: NONCE,
    expiresAfter: NONCE,
  }),
  "0xc30b002ba3775e4c31c43c1dfd3291dfc85c6ae06c6b9f393991de86cad5fac7",
);
assert.equal(
  createL1ActionHash({
    action: L1_ACTION,
    nonce: NONCE,
    vaultAddress: VAULT,
    expiresAfter: NONCE,
  }),
  "0x2d62412aa0fc57441b5189841d81554a6a9680bf07204e1454983a9ca44f0744",
);

const testnet = signL1Action({
  agentKey: KEY,
  action: L1_ACTION,
  nonce: NONCE,
  isMainnet: false,
});
assert.equal("error" in testnet, false);
if (!("error" in testnet)) {
  assert.equal(
    testnet.r,
    "0x6b0283a894d87b996ad0182b86251cc80d27d61ef307449a2ed249a508ded1f7",
  );
  assert.equal(
    testnet.s,
    "0x6f884e79f4a0a10af62db831af6f8e03b3f11d899eb49b352f836746ee9226da",
  );
  assert.equal(testnet.v, 27);
}

const mainnet = signL1Action({
  agentKey: KEY,
  action: L1_ACTION,
  nonce: NONCE,
  isMainnet: true,
});
assert.equal("error" in mainnet, false);
if (!("error" in mainnet)) {
  assert.equal(
    mainnet.r,
    "0x61078d8ffa3cb591de045438a1ae2ed299b271891d1943a33901e7cfb3a31ed8",
  );
  assert.equal(
    mainnet.s,
    "0x0e91df4f9841641d3322dad8d932874b74d7e082cdb5b533f804964a6963aef9",
  );
  assert.equal(mainnet.v, 28);
}

console.log("hyperliquid sign checks passed");
