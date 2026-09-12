import assert from "node:assert/strict";
import { deriveDepositAddress, normalizeEvmAddress } from "./hd";

const MNEMONIC =
  "test test test test test test test test test test test junk";

assert.equal(
  deriveDepositAddress(MNEMONIC, 0),
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
);
assert.equal(
  deriveDepositAddress(MNEMONIC, 1),
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
);
assert.equal(
  deriveDepositAddress(MNEMONIC, 0),
  deriveDepositAddress(MNEMONIC, 0),
);
assert.notEqual(
  deriveDepositAddress(MNEMONIC, 0),
  deriveDepositAddress(MNEMONIC, 1),
);
assert.throws(() => deriveDepositAddress(MNEMONIC, -1));
assert.equal(
  normalizeEvmAddress("0xF39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
);
assert.equal(normalizeEvmAddress("not-an-address"), null);

console.log("membership hd checks passed");
