import assert from "node:assert/strict";
import {
  agentAddressFromPrivateKey,
  hyperliquidFingerprint,
  normalizeAddress,
} from "./agent";

assert.equal(normalizeAddress("0xABC"), null);
assert.equal(
  normalizeAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
);

const anvil = agentAddressFromPrivateKey(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
assert.equal(anvil, "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
assert.equal(hyperliquidFingerprint(anvil ?? ""), "2266");
assert.equal(agentAddressFromPrivateKey("nope"), null);

console.log("hyperliquid agent checks passed");
