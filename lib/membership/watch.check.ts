import assert from "node:assert/strict";
import {
  confirmedBlock,
  ERC20_TRANSFER_TOPIC,
  padAddressTopic,
  parseErc20TransferLog,
  scanWindow,
  topicAddress,
} from "./watch";

assert.equal(
  topicAddress(
    "0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  ),
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
);
assert.equal(
  padAddressTopic("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
  "0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266",
);

const parsed = parseErc20TransferLog({
  topics: [
    ERC20_TRANSFER_TOPIC,
    "0x0000000000000000000000001111111111111111111111111111111111111111",
    "0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  ],
  data: "0x0000000000000000000000000000000000000000000000000000000000989680",
  transactionHash:
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  logIndex: 3,
  blockNumber: "0x10",
});
assert.ok(parsed);
assert.equal(parsed.to, "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
assert.equal(parsed.amount, BigInt(10000000));
assert.equal(parsed.logIndex, 3);
assert.equal(parsed.blockNumber, BigInt(16));
assert.equal(confirmedBlock(BigInt(10), BigInt(12), 3), true);
assert.equal(confirmedBlock(BigInt(10), BigInt(11), 3), false);
assert.deepEqual(
  scanWindow({
    headBlock: BigInt(100),
    lastScanned: BigInt(90),
    lookback: BigInt(80),
    chunk: BigInt(20),
  }),
  { fromBlock: BigInt(91), toBlock: BigInt(100) },
);

console.log("membership watch checks passed");
