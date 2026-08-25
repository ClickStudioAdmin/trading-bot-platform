import type { FuturesSide, FuturesTrigger } from "./model";
import { asPositiveNumber } from "./model";
import { priceForPerp } from "@/lib/exchanges/bybit/perp";
import type { BybitInstrument } from "@/lib/exchanges/bybit/universe";

export type FuturesTpsl = {
  takeProfit: number | null;
  stopLoss: number | null;
  tpTrigger: FuturesTrigger;
  slTrigger: FuturesTrigger;
};

export function parseFuturesTrigger(
  raw: unknown,
): { ok: true; trigger: FuturesTrigger } | { ok: false; error: string } {
  const trigger = String(raw ?? "last").trim().toLowerCase();
  if (trigger === "" || trigger === "last" || trigger === "lastprice") {
    return { ok: true, trigger: "last" };
  }
  if (trigger === "mark" || trigger === "markprice") {
    return { ok: true, trigger: "mark" };
  }
  if (trigger === "index" || trigger === "indexprice") {
    return { ok: true, trigger: "index" };
  }
  return { ok: false, error: "Choose Last, Mark, or Index." };
}

export function parseFuturesOptionalPrice(
  raw: unknown,
  label: string,
): { ok: true; price: number | null } | { ok: false; error: string } {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (text === "") {
    return { ok: true, price: null };
  }
  const price = asPositiveNumber(text);
  if (price === null) {
    return { ok: false, error: `Enter a positive ${label}.` };
  }
  return { ok: true, price };
}

export function parseFuturesTpslForm(
  form: FormData,
  instrument: BybitInstrument | undefined,
): { ok: true; tpsl: FuturesTpsl | null } | { ok: false; error: string } {
  const enabled =
    form.get("tpsl") === "on" ||
    form.get("tpsl") === "true" ||
    form.has("tpslEnabled");
  if (!enabled) {
    return { ok: true, tpsl: null };
  }
  const takeRaw = parseFuturesOptionalPrice(form.get("takeProfit"), "take profit");
  if (!takeRaw.ok) {
    return takeRaw;
  }
  const stopRaw = parseFuturesOptionalPrice(form.get("stopLoss"), "stop loss");
  if (!stopRaw.ok) {
    return stopRaw;
  }
  if (takeRaw.price === null && stopRaw.price === null) {
    return { ok: false, error: "Enter a take profit, a stop loss, or both." };
  }
  const tpTrigger = parseFuturesTrigger(form.get("tpTrigger"));
  if (!tpTrigger.ok) {
    return tpTrigger;
  }
  const slTrigger = parseFuturesTrigger(form.get("slTrigger"));
  if (!slTrigger.ok) {
    return slTrigger;
  }
  let takeProfit: number | null = takeRaw.price;
  let stopLoss: number | null = stopRaw.price;
  if (takeProfit !== null) {
    const priced = priceForPerp(takeProfit, instrument);
    if (!priced.ok) {
      return priced;
    }
    takeProfit = priced.price;
  }
  if (stopLoss !== null) {
    const priced = priceForPerp(stopLoss, instrument);
    if (!priced.ok) {
      return priced;
    }
    stopLoss = priced.price;
  }
  return {
    ok: true,
    tpsl: {
      takeProfit,
      stopLoss,
      tpTrigger: tpTrigger.trigger,
      slTrigger: slTrigger.trigger,
    },
  };
}

export function parseFuturesTpslPatch(
  form: FormData,
  instrument: BybitInstrument | undefined,
): { ok: true; tpsl: FuturesTpsl } | { ok: false; error: string } {
  const takeRaw = parseFuturesOptionalPrice(form.get("takeProfit"), "take profit");
  if (!takeRaw.ok) {
    return takeRaw;
  }
  const stopRaw = parseFuturesOptionalPrice(form.get("stopLoss"), "stop loss");
  if (!stopRaw.ok) {
    return stopRaw;
  }
  const tpTrigger = parseFuturesTrigger(form.get("tpTrigger"));
  if (!tpTrigger.ok) {
    return tpTrigger;
  }
  const slTrigger = parseFuturesTrigger(form.get("slTrigger"));
  if (!slTrigger.ok) {
    return slTrigger;
  }
  let takeProfit = takeRaw.price;
  let stopLoss = stopRaw.price;
  if (takeProfit !== null) {
    const priced = priceForPerp(takeProfit, instrument);
    if (!priced.ok) {
      return priced;
    }
    takeProfit = priced.price;
  }
  if (stopLoss !== null) {
    const priced = priceForPerp(stopLoss, instrument);
    if (!priced.ok) {
      return priced;
    }
    stopLoss = priced.price;
  }
  return {
    ok: true,
    tpsl: {
      takeProfit,
      stopLoss,
      tpTrigger: tpTrigger.trigger,
      slTrigger: slTrigger.trigger,
    },
  };
}

export function validateTpslVsReference(input: {
  side: FuturesSide;
  tpsl: FuturesTpsl;
  reference: number;
}): { ok: true } | { ok: false; error: string } {
  if (!(input.reference > 0)) {
    return { ok: false, error: "Need a mark or entry to check TP/SL." };
  }
  if (input.tpsl.takeProfit !== null) {
    const ok =
      input.side === "long"
        ? input.tpsl.takeProfit > input.reference
        : input.tpsl.takeProfit < input.reference;
    if (!ok) {
      return {
        ok: false,
        error:
          input.side === "long"
            ? "Take profit must be above the current price."
            : "Take profit must be below the current price.",
      };
    }
  }
  if (input.tpsl.stopLoss !== null) {
    const ok =
      input.side === "long"
        ? input.tpsl.stopLoss < input.reference
        : input.tpsl.stopLoss > input.reference;
    if (!ok) {
      return {
        ok: false,
        error:
          input.side === "long"
            ? "Stop loss must be below the current price."
            : "Stop loss must be above the current price.",
      };
    }
  }
  return { ok: true };
}

export function paperStopHit(input: {
  side: FuturesSide;
  tpsl: FuturesTpsl;
  last: number | null;
  mark: number | null;
  index: number | null;
}): { kind: "take_profit" | "stop_loss"; price: number } | null {
  const tpPrice = triggerPrice(input.tpsl.tpTrigger, input);
  const slPrice = triggerPrice(input.tpsl.slTrigger, input);
  if (input.tpsl.stopLoss !== null && slPrice !== null) {
    const hit =
      input.side === "long"
        ? slPrice <= input.tpsl.stopLoss
        : slPrice >= input.tpsl.stopLoss;
    if (hit) {
      return { kind: "stop_loss", price: input.tpsl.stopLoss };
    }
  }
  if (input.tpsl.takeProfit !== null && tpPrice !== null) {
    const hit =
      input.side === "long"
        ? tpPrice >= input.tpsl.takeProfit
        : tpPrice <= input.tpsl.takeProfit;
    if (hit) {
      return { kind: "take_profit", price: input.tpsl.takeProfit };
    }
  }
  return null;
}

export function triggerPrice(
  trigger: FuturesTrigger,
  prices: { last: number | null; mark: number | null; index: number | null },
): number | null {
  if (trigger === "index") {
    return prices.index ?? prices.mark ?? prices.last;
  }
  if (trigger === "mark") {
    return prices.mark ?? prices.last;
  }
  return prices.last ?? prices.mark;
}

export function tickerTriggerPrices(ticker: {
  lastPrice?: string;
  markPrice?: string;
  indexPrice?: string;
  bid1Price?: string;
  ask1Price?: string;
}): { last: number | null; mark: number | null; index: number | null } {
  const last = Number(ticker.lastPrice ?? "");
  const mark = Number(ticker.markPrice ?? "");
  const index = Number(ticker.indexPrice ?? "");
  const bid = Number(ticker.bid1Price ?? "");
  const ask = Number(ticker.ask1Price ?? "");
  const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : null;
  return {
    last: last > 0 ? last : mid,
    mark: mark > 0 ? mark : last > 0 ? last : mid,
    index: index > 0 ? index : mark > 0 ? mark : last > 0 ? last : mid,
  };
}

export function bybitTriggerBy(
  trigger: FuturesTrigger,
): "LastPrice" | "MarkPrice" | "IndexPrice" {
  if (trigger === "mark") {
    return "MarkPrice";
  }
  if (trigger === "index") {
    return "IndexPrice";
  }
  return "LastPrice";
}

export function venueTradingStopFields(tpsl: FuturesTpsl): {
  takeProfit: string;
  stopLoss: string;
  tpTriggerBy: "LastPrice" | "MarkPrice" | "IndexPrice";
  slTriggerBy: "LastPrice" | "MarkPrice" | "IndexPrice";
} {
  return {
    takeProfit: tpsl.takeProfit !== null ? String(tpsl.takeProfit) : "0",
    stopLoss: tpsl.stopLoss !== null ? String(tpsl.stopLoss) : "0",
    tpTriggerBy: bybitTriggerBy(tpsl.tpTrigger),
    slTriggerBy: bybitTriggerBy(tpsl.slTrigger),
  };
}

export function venueTpslFields(tpsl: FuturesTpsl | null | undefined): {
  takeProfit?: string;
  stopLoss?: string;
  tpTriggerBy?: "LastPrice" | "MarkPrice" | "IndexPrice";
  slTriggerBy?: "LastPrice" | "MarkPrice" | "IndexPrice";
} | undefined {
  if (!tpslHasLevels(tpsl) || !tpsl) {
    return undefined;
  }
  return {
    takeProfit: tpsl.takeProfit !== null ? String(tpsl.takeProfit) : undefined,
    stopLoss: tpsl.stopLoss !== null ? String(tpsl.stopLoss) : undefined,
    tpTriggerBy: bybitTriggerBy(tpsl.tpTrigger),
    slTriggerBy: bybitTriggerBy(tpsl.slTrigger),
  };
}

export function tpslColumns(tpsl: FuturesTpsl | null | undefined) {
  return {
    take_profit: tpsl?.takeProfit ?? null,
    stop_loss: tpsl?.stopLoss ?? null,
    tp_trigger: tpslHasLevels(tpsl) ? tpsl?.tpTrigger ?? "last" : null,
    sl_trigger: tpslHasLevels(tpsl) ? tpsl?.slTrigger ?? "last" : null,
  };
}

export function tpslFromRow(row: {
  takeProfit: number | null;
  stopLoss: number | null;
  tpTrigger: FuturesTrigger;
  slTrigger: FuturesTrigger;
}): FuturesTpsl | null {
  if (row.takeProfit === null && row.stopLoss === null) {
    return null;
  }
  return {
    takeProfit: row.takeProfit,
    stopLoss: row.stopLoss,
    tpTrigger: row.tpTrigger,
    slTrigger: row.slTrigger,
  };
}

export function tpslHasLevels(tpsl: FuturesTpsl | null | undefined): boolean {
  return Boolean(tpsl && (tpsl.takeProfit !== null || tpsl.stopLoss !== null));
}

export function estimatedTpslPnl(input: {
  side: FuturesSide;
  qty: number;
  entryPrice: number;
  exitPrice: number | null;
}): number | null {
  if (input.exitPrice === null || !(input.qty > 0) || !(input.entryPrice > 0)) {
    return null;
  }
  const move =
    input.side === "long"
      ? input.exitPrice - input.entryPrice
      : input.entryPrice - input.exitPrice;
  return move * input.qty;
}
