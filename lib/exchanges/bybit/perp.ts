import { fetchBybitInstruments } from "./client";
import { floorToStep, parseStep, qtyFromNotionalUsdt, stepDecimals } from "./qty";
import type { BybitInstrument } from "./universe";

const PINNED_BASE_COINS = ["BTC", "ETH", "SOL", "DOGE", "XRP", "MNT"];

export type LinearPerp = {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
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

export function qtyForPerp(
  qty: number,
  instrument: BybitInstrument | undefined,
): { ok: true; qty: number; text: string } | { ok: false; error: string } {
  const step = lotStep(instrument, 0.001);
  const minQty = Math.max(lotMin(instrument, step), step);
  const floored = floorToStep(qty, step);
  if (!(floored > 0) || floored < minQty) {
    return {
      ok: false,
      error: "That size is below the exchange minimum order quantity.",
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
      error: "That size is below the exchange minimum order value.",
    };
  }
  return qtyFromNotionalUsdt({
    notionalUsdt,
    price,
    step,
    minQty,
  });
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
    .map((row) => ({
      symbol: row.symbol,
      baseCoin: row.baseCoin,
      quoteCoin: row.quoteCoin || row.settleCoin || "USDT",
    }))
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
