import assert from "node:assert/strict";
import {
  applyBybitTickerMessage,
  bybitLinearPublicWsUrl,
  chunkBybitTopics,
  mergeBybitTicker,
} from "./ticker-stream";

assert.equal(
  bybitLinearPublicWsUrl(),
  "wss://stream.bybit.com/v5/public/linear",
);

const merged = mergeBybitTicker(
  {
    symbol: "BTCUSDT",
    lastPrice: "100",
    markPrice: "101",
    indexPrice: "99",
  },
  { symbol: "BTCUSDT", lastPrice: "110" },
);
assert.equal(merged.lastPrice, "110");
assert.equal(merged.markPrice, "101");
assert.equal(merged.indexPrice, "99");

const book = new Map();
assert.equal(
  applyBybitTickerMessage(
    JSON.stringify({
      topic: "tickers.ETHUSDT",
      data: { symbol: "ETHUSDT", lastPrice: "200", markPrice: "201" },
    }),
    book,
  ),
  true,
);
assert.equal(book.get("ETHUSDT")?.markPrice, "201");
assert.equal(
  applyBybitTickerMessage(
    JSON.stringify({
      topic: "tickers.ETHUSDT",
      type: "delta",
      data: { symbol: "ETHUSDT", lastPrice: "205" },
    }),
    book,
  ),
  true,
);
assert.equal(book.get("ETHUSDT")?.lastPrice, "205");
assert.equal(book.get("ETHUSDT")?.markPrice, "201");
assert.equal(applyBybitTickerMessage('{"op":"pong"}', book), false);

const topics = Array.from({ length: 30 }, (_, index) => `tickers.COIN${index}USDT`);
const chunks = chunkBybitTopics(topics, 80);
assert.ok(chunks.length > 1);
assert.ok(chunks.every((chunk) => chunk.join(",").length <= 80));
assert.equal(
  chunks.flat().length,
  topics.length,
);

console.log("bybit ticker stream checks passed");
