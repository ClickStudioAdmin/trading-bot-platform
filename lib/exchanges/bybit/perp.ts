import { fetchBybitInstruments } from "./client";
import { floorToStep, parseStep, qtyFromNotionalUsdt, stepDecimals } from "./qty";
import { formatPerpMinQty } from "./ticket-size";
import type { BybitInstrument } from "./universe";

const PINNED_BASE_COINS = ["BTC", "ETH", "SOL", "DOGE", "XRP", "MNT"];

export type LinearPerp = {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  minQty: number;
  maxQty: number;
  maxMktQty: number;
  minNotional: number;
  minPrice: number;
  tickSize: number;
};

export function isUsdtLinearPerp(instrument: BybitInstrument): boolean {
  if (instrument.status !== "Trading") {
    return false;
  }
  if (instrument.quoteCoin !== "USDT" && instrument.settleCoin !== "USDT") {
    return false;
  }
  if (instrument.contractType && instrument.contractType !== "LinearPerpetual") {
    return false;
  }
  const delivery = Number(instrument.deliveryTime ?? "0");
  if (Number.isFinite(delivery) && delivery > 0) {
    return false;
  }
  return true;
}

function lotStep(instrument: BybitInstrument | undefined, fallback: number): number {
  const filter = instrument?.lotSizeFilter;
  return parseStep(filter?.qtyStep ?? filter?.basePrecision, fallback);
}

function lotMin(instrument: BybitInstrument | undefined, step: number): number {
  return parseStep(instrument?.lotSizeFilter?.minOrderQty, step);
}

function lotMax(instrument: BybitInstrument | undefined): number {
  return parseStep(instrument?.lotSizeFilter?.maxOrderQty, 0);
}

function lotMaxMkt(instrument: BybitInstrument | undefined): number {
  return parseStep(instrument?.lotSizeFilter?.maxMktOrderQty, 0);
}

export function qtyForPerp(
  qty: number,
  instrument: BybitInstrument | undefined,
): { ok: true; qty: number; text: string } | { ok: false; error: string } {
  const step = lotStep(instrument, 0.001);
  const minQty = Math.max(lotMin(instrument, step), step);
  const floored = floorToStep(qty, step);
  if (!(floored > 0) || floored < minQty) {
    const coin = instrument?.baseCoin ? ` ${instrument.baseCoin}` : "";
    return {
      ok: false,
      error: `Minimum size is ${formatPerpMinQty(minQty)}${coin}.`,
    };
  }
  const maxQty = lotMax(instrument);
  if (maxQty > 0 && floored > maxQty) {
    return {
      ok: false,
      error: "That size is above the exchange maximum order quantity.",
    };
  }
  return {
    ok: true,
    qty: floored,
    text: floored.toFixed(stepDecimals(step)),
  };
}

export function qtyForPerpNotional(
  notionalUsdt: number,
  price: number,
  instrument: BybitInstrument | undefined,
): { ok: true; qty: number; text: string } | { ok: false; error: string } {
  const step = lotStep(instrument, 0.001);
  const minQty = Math.max(lotMin(instrument, step), step);
  const minNotional = parseStep(
    instrument?.lotSizeFilter?.minNotionalValue ??
      instrument?.lotSizeFilter?.minOrderAmt,
    0,
  );
  if (minNotional > 0 && notionalUsdt < minNotional) {
    return {
      ok: false,
      error: `Minimum order value is $${formatPerpMinQty(minNotional)}.`,
    };
  }
  const sized = qtyFromNotionalUsdt({
    notionalUsdt,
    price,
    step,
    minQty,
    maxQty: lotMax(instrument),
  });
  if (!sized.ok && sized.error.includes("minimum order quantity")) {
    const minUsdt = minQty * price;
    const coin = instrument?.baseCoin ? ` ${instrument.baseCoin}` : "";
    return {
      ok: false,
      error: `Minimum order is $${formatPerpMinQty(minUsdt)} (${formatPerpMinQty(minQty)}${coin}).`,
    };
  }
  return sized;
}

export function priceForPerp(
  price: number,
  instrument: BybitInstrument | undefined,
): { ok: true; price: number; text: string } | { ok: false; error: string } {
  const tick = parseStep(instrument?.priceFilter?.tickSize, 0.01);
  const floored = floorToStep(price, tick);
  if (!(floored > 0)) {
    return { ok: false, error: "Enter a positive limit price." };
  }
  const minPrice = parseStep(instrument?.priceFilter?.minPrice, 0);
  if (minPrice > 0 && floored < minPrice) {
    return { ok: false, error: "That limit is below the exchange minimum price." };
  }
  return {
    ok: true,
    price: floored,
    text: floored.toFixed(stepDecimals(tick)),
  };
}

function baseRank(baseCoin: string): number {
  const pinned = PINNED_BASE_COINS.indexOf(baseCoin);
  return pinned === -1 ? PINNED_BASE_COINS.length : pinned;
}

export function listUsdtLinearPerps(
  instruments: BybitInstrument[],
): LinearPerp[] {
  return instruments
    .filter(isUsdtLinearPerp)
    .map((row) => {
      const step = lotStep(row, 0.001);
      const tickSize = parseStep(row.priceFilter?.tickSize, 0.01);
      return {
        symbol: row.symbol,
        baseCoin: row.baseCoin,
        quoteCoin: row.quoteCoin || row.settleCoin || "USDT",
        minQty: Math.max(lotMin(row, step), step),
        maxQty: lotMax(row),
        maxMktQty: lotMaxMkt(row),
        minNotional: parseStep(
          row.lotSizeFilter?.minNotionalValue ?? row.lotSizeFilter?.minOrderAmt,
          0,
        ),
        minPrice: parseStep(row.priceFilter?.minPrice, 0),
        tickSize,
      };
    })
    .sort((a, b) => {
      const rank = baseRank(a.baseCoin) - baseRank(b.baseCoin);
      if (rank !== 0) {
        return rank;
      }
      if (a.baseCoin !== b.baseCoin) {
        return a.baseCoin.localeCompare(b.baseCoin);
      }
      const aPlain = a.symbol === `${a.baseCoin}USDT` ? 0 : 1;
      const bPlain = b.symbol === `${b.baseCoin}USDT` ? 0 : 1;
      if (aPlain !== bPlain) {
        return aPlain - bPlain;
      }
      return a.symbol.localeCompare(b.symbol);
    });
}

export async function loadUsdtLinearPerps(): Promise<LinearPerp[]> {
  return listUsdtLinearPerps(await fetchBybitInstruments("linear"));
}

export function baseCoinForPerpSymbol(
  symbol: string,
  options: LinearPerp[],
): string {
  return (
    options.find((row) => row.symbol === symbol)?.baseCoin ??
    symbol.replace(/USDT$/, "")
  );
}

export async function loadPerpInstrument(
  symbol: string,
): Promise<BybitInstrument | undefined> {
  const rows = await fetchBybitInstruments("linear", symbol);
  return rows.find((row) => row.symbol === symbol && isUsdtLinearPerp(row));
}
