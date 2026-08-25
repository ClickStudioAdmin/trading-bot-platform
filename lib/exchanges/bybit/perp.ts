import { fetchBybitInstruments } from "./client";
import { floorToStep, parseStep, stepDecimals } from "./qty";
import type { BybitInstrument } from "./universe";

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

export async function loadPerpInstrument(
  symbol: string,
): Promise<BybitInstrument | undefined> {
  const rows = await fetchBybitInstruments("linear", symbol);
  return rows.find((row) => row.symbol === symbol && isUsdtLinearPerp(row));
}
