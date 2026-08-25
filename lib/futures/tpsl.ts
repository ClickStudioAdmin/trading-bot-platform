import type { FuturesSide, FuturesTpslMode, FuturesTrigger } from "./model";
import { asPositiveNumber } from "./model";
import { priceForPerp, qtyForPerp } from "@/lib/exchanges/bybit/perp";
import type { BybitInstrument } from "@/lib/exchanges/bybit/universe";

export type { FuturesTpslMode } from "./model";

export type FuturesTpsl = {
  takeProfit: number | null;
  stopLoss: number | null;
  tpTrigger: FuturesTrigger;
  slTrigger: FuturesTrigger;
  mode: FuturesTpslMode;
  tpQty: number | null;
  slQty: number | null;
};

const QTY_EPS = 1e-12;

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

export function parseFuturesTpslMode(
  raw: unknown,
): { ok: true; mode: FuturesTpslMode } | { ok: false; error: string } {
  const mode = String(raw ?? "full").trim().toLowerCase();
  if (mode === "" || mode === "full" || mode === "entire") {
    return { ok: true, mode: "full" };
  }
  if (mode === "partial") {
    return { ok: true, mode: "partial" };
  }
  return { ok: false, error: "Choose Entire position or Partial." };
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

function parseFuturesOptionalQty(
  raw: unknown,
  label: string,
  instrument: BybitInstrument | undefined,
): { ok: true; qty: number | null } | { ok: false; error: string } {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (text === "") {
    return { ok: true, qty: null };
  }
  const qty = asPositiveNumber(text);
  if (qty === null) {
    return { ok: false, error: `Enter a positive ${label} quantity.` };
  }
  const sized = qtyForPerp(qty, instrument);
  if (!sized.ok) {
    return sized;
  }
  return { ok: true, qty: sized.qty };
}

function readTpslFromForm(
  form: FormData,
  instrument: BybitInstrument | undefined,
  requireLevel: boolean,
): { ok: true; tpsl: FuturesTpsl } | { ok: false; error: string } {
  const takeRaw = parseFuturesOptionalPrice(form.get("takeProfit"), "take profit");
  if (!takeRaw.ok) {
    return takeRaw;
  }
  const stopRaw = parseFuturesOptionalPrice(form.get("stopLoss"), "stop loss");
  if (!stopRaw.ok) {
    return stopRaw;
  }
  if (requireLevel && takeRaw.price === null && stopRaw.price === null) {
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
  const modeParsed = parseFuturesTpslMode(form.get("tpslMode"));
  if (!modeParsed.ok) {
    return modeParsed;
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
  let tpQty: number | null = null;
  let slQty: number | null = null;
  const mode = modeParsed.mode;
  if (mode === "partial") {
    const tpQtyRaw = parseFuturesOptionalQty(
      form.get("tpQty"),
      "take profit",
      instrument,
    );
    if (!tpQtyRaw.ok) {
      return tpQtyRaw;
    }
    const slQtyRaw = parseFuturesOptionalQty(
      form.get("slQty"),
      "stop loss",
      instrument,
    );
    if (!slQtyRaw.ok) {
      return slQtyRaw;
    }
    if (takeProfit !== null) {
      if (tpQtyRaw.qty === null) {
        return { ok: false, error: "Enter a take profit quantity." };
      }
      tpQty = tpQtyRaw.qty;
    }
    if (stopLoss !== null) {
      if (slQtyRaw.qty === null) {
        return { ok: false, error: "Enter a stop loss quantity." };
      }
      slQty = slQtyRaw.qty;
    }
  }
  return {
    ok: true,
    tpsl: {
      takeProfit,
      stopLoss,
      tpTrigger: tpTrigger.trigger,
      slTrigger: slTrigger.trigger,
      mode,
      tpQty,
      slQty,
    },
  };
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
  const parsed = readTpslFromForm(form, instrument, true);
  if (!parsed.ok) {
    return parsed;
  }
  return parsed;
}

export function parseFuturesTpslPatch(
  form: FormData,
  instrument: BybitInstrument | undefined,
): { ok: true; tpsl: FuturesTpsl } | { ok: false; error: string } {
  return readTpslFromForm(form, instrument, false);
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

export function validateTpslQty(input: {
  tpsl: FuturesTpsl;
  capQty: number;
  capLabel: string;
}): { ok: true } | { ok: false; error: string } {
  if (input.tpsl.mode !== "partial") {
    return { ok: true };
  }
  if (!(input.capQty > 0)) {
    return { ok: false, error: `Need a ${input.capLabel} to set a partial stop.` };
  }
  if (input.tpsl.tpQty !== null && input.tpsl.tpQty > input.capQty + QTY_EPS) {
    return {
      ok: false,
      error: `Take profit quantity cannot exceed the ${input.capLabel}.`,
    };
  }
  if (input.tpsl.slQty !== null && input.tpsl.slQty > input.capQty + QTY_EPS) {
    return {
      ok: false,
      error: `Stop loss quantity cannot exceed the ${input.capLabel}.`,
    };
  }
  return { ok: true };
}

export function paperStopLossHit(input: {
  side: FuturesSide;
  tpsl: FuturesTpsl;
  last: number | null;
  mark: number | null;
  index: number | null;
}): { kind: "stop_loss"; price: number } | null {
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
  return null;
}

export function paperTakeProfitHit(input: {
  side: FuturesSide;
  tpsl: FuturesTpsl;
  last: number | null;
  mark: number | null;
  index: number | null;
}): { kind: "take_profit"; price: number } | null {
  const tpPrice = triggerPrice(input.tpsl.tpTrigger, input);
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

export function paperStopHit(input: {
  side: FuturesSide;
  tpsl: FuturesTpsl;
  last: number | null;
  mark: number | null;
  index: number | null;
}): { kind: "take_profit" | "stop_loss"; price: number } | null {
  return paperStopLossHit(input) ?? paperTakeProfitHit(input);
}

export function paperStopCloseQty(input: {
  positionQty: number;
  tpsl: FuturesTpsl;
  kind: "take_profit" | "stop_loss";
}): number {
  if (!(input.positionQty > 0)) {
    return 0;
  }
  if (input.tpsl.mode !== "partial") {
    return input.positionQty;
  }
  const sized =
    input.kind === "take_profit" ? input.tpsl.tpQty : input.tpsl.slQty;
  if (sized === null || !(sized > 0)) {
    return input.positionQty;
  }
  return Math.min(input.positionQty, sized);
}

function capPartialQty(qty: number | null, remainingQty: number): number | null {
  if (qty === null || !(qty > 0) || !(remainingQty > QTY_EPS)) {
    return null;
  }
  const capped = Math.min(qty, remainingQty);
  return capped > QTY_EPS ? capped : null;
}

export function tpslAfterStopHit(
  tpsl: FuturesTpsl,
  kind: "take_profit" | "stop_loss",
  remainingQty: number,
): FuturesTpsl | null {
  const next: FuturesTpsl = {
    ...tpsl,
    takeProfit: kind === "take_profit" ? null : tpsl.takeProfit,
    stopLoss: kind === "stop_loss" ? null : tpsl.stopLoss,
    tpQty:
      kind === "take_profit" ? null : capPartialQty(tpsl.tpQty, remainingQty),
    slQty:
      kind === "stop_loss" ? null : capPartialQty(tpsl.slQty, remainingQty),
  };
  if (!tpslHasLevels(next)) {
    return null;
  }
  if (next.takeProfit === null) {
    next.tpQty = null;
  }
  if (next.stopLoss === null) {
    next.slQty = null;
  }
  if (next.tpQty === null && next.slQty === null) {
    next.mode = "full";
  }
  return next;
}

export function remainingTpslFromVenue(
  tpsl: FuturesTpsl,
  venue: { takeProfit: number | null; stopLoss: number | null } | null,
  remainingQty: number,
): FuturesTpsl | null {
  if (!venue) {
    return null;
  }
  const next: FuturesTpsl = {
    ...tpsl,
    takeProfit: venue.takeProfit,
    stopLoss: venue.stopLoss,
    tpQty:
      venue.takeProfit === null
        ? null
        : capPartialQty(tpsl.tpQty, remainingQty),
    slQty:
      venue.stopLoss === null ? null : capPartialQty(tpsl.slQty, remainingQty),
  };
  if (!tpslHasLevels(next)) {
    return null;
  }
  if (next.tpQty === null && next.slQty === null) {
    next.mode = "full";
  }
  return next;
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

export type VenueTradingStopFields = {
  takeProfit: string;
  stopLoss: string;
  tpTriggerBy: "LastPrice" | "MarkPrice" | "IndexPrice";
  slTriggerBy: "LastPrice" | "MarkPrice" | "IndexPrice";
  tpslMode: "Full" | "Partial";
  tpSize?: string;
  slSize?: string;
  trailingStop?: string;
  activePrice?: string;
};

export function venueTradingStopFields(tpsl: FuturesTpsl): VenueTradingStopFields {
  const partial = tpsl.mode === "partial" && tpslHasLevels(tpsl);
  return {
    takeProfit: tpsl.takeProfit !== null ? String(tpsl.takeProfit) : "0",
    stopLoss: tpsl.stopLoss !== null ? String(tpsl.stopLoss) : "0",
    tpTriggerBy: bybitTriggerBy(tpsl.tpTrigger),
    slTriggerBy: bybitTriggerBy(tpsl.slTrigger),
    tpslMode: partial ? "Partial" : "Full",
    tpSize: partial && tpsl.tpQty !== null ? String(tpsl.tpQty) : undefined,
    slSize: partial && tpsl.slQty !== null ? String(tpsl.slQty) : undefined,
  };
}

export function applyTrailingToVenueStop(
  stop: VenueTradingStopFields,
  trailing: { distance: number; activePrice: number | null } | null | undefined,
): VenueTradingStopFields {
  if (trailing && trailing.distance > 0) {
    return {
      ...stop,
      trailingStop: String(trailing.distance),
      activePrice:
        trailing.activePrice !== null ? String(trailing.activePrice) : undefined,
    };
  }
  if (trailing === null) {
    return { ...stop, trailingStop: "0" };
  }
  return stop;
}

export function emptyFuturesTpsl(): FuturesTpsl {
  return {
    takeProfit: null,
    stopLoss: null,
    tpTrigger: "last",
    slTrigger: "last",
    mode: "full",
    tpQty: null,
    slQty: null,
  };
}

export function combinedVenueTradingStop(
  tpsl: FuturesTpsl | null | undefined,
  trailing: { distance: number; activePrice: number | null } | null,
): VenueTradingStopFields {
  return applyTrailingToVenueStop(
    venueTradingStopFields(tpsl ?? emptyFuturesTpsl()),
    trailing,
  );
}

export function venueTpslFields(tpsl: FuturesTpsl | null | undefined): {
  takeProfit?: string;
  stopLoss?: string;
  tpTriggerBy?: "LastPrice" | "MarkPrice" | "IndexPrice";
  slTriggerBy?: "LastPrice" | "MarkPrice" | "IndexPrice";
  tpslMode?: "Full" | "Partial";
  tpSize?: string;
  slSize?: string;
} | undefined {
  if (!tpslHasLevels(tpsl) || !tpsl) {
    return undefined;
  }
  const partial = tpsl.mode === "partial";
  return {
    takeProfit: tpsl.takeProfit !== null ? String(tpsl.takeProfit) : undefined,
    stopLoss: tpsl.stopLoss !== null ? String(tpsl.stopLoss) : undefined,
    tpTriggerBy: bybitTriggerBy(tpsl.tpTrigger),
    slTriggerBy: bybitTriggerBy(tpsl.slTrigger),
    tpslMode: partial ? "Partial" : "Full",
    tpSize: partial && tpsl.tpQty !== null ? String(tpsl.tpQty) : undefined,
    slSize: partial && tpsl.slQty !== null ? String(tpsl.slQty) : undefined,
  };
}

export function tpslColumns(tpsl: FuturesTpsl | null | undefined) {
  const has = tpslHasLevels(tpsl);
  const partial = has && tpsl?.mode === "partial";
  return {
    take_profit: tpsl?.takeProfit ?? null,
    stop_loss: tpsl?.stopLoss ?? null,
    tp_trigger: has ? tpsl?.tpTrigger ?? "last" : null,
    sl_trigger: has ? tpsl?.slTrigger ?? "last" : null,
    tpsl_mode: has ? tpsl?.mode ?? "full" : null,
    tp_qty: partial ? tpsl?.tpQty ?? null : null,
    sl_qty: partial ? tpsl?.slQty ?? null : null,
  };
}

export function tpslFromRow(row: {
  takeProfit: number | null;
  stopLoss: number | null;
  tpTrigger: FuturesTrigger;
  slTrigger: FuturesTrigger;
  tpslMode?: FuturesTpslMode | null;
  tpQty?: number | null;
  slQty?: number | null;
}): FuturesTpsl | null {
  if (row.takeProfit === null && row.stopLoss === null) {
    return null;
  }
  const mode = row.tpslMode === "partial" ? "partial" : "full";
  return {
    takeProfit: row.takeProfit,
    stopLoss: row.stopLoss,
    tpTrigger: row.tpTrigger,
    slTrigger: row.slTrigger,
    mode,
    tpQty: mode === "partial" ? row.tpQty ?? null : null,
    slQty: mode === "partial" ? row.slQty ?? null : null,
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
