import { loadEngineSettings } from "@/lib/engine/settings";
import { floorCarryQty, loadCarryInstruments } from "@/lib/exchanges/bybit/orders";
import type { VenueFill } from "@/lib/exchanges/execute";
import {
  loadBoundConnectionSecrets,
  type BoundConnectionSecrets,
} from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import type { TradingAccountMode } from "@/lib/accounts/model";
import {
  closeQtyFromOpenFills,
  type PaperOrderRow,
} from "@/lib/paper/orders";

export async function loadBoundVenueForAccount(input: {
  userId: string;
  accountId: string;
  mode: TradingAccountMode;
  connectionId?: string | null;
}): Promise<
  { ok: true; connection: BoundConnectionSecrets } | { ok: false; error: string }
> {
  if (!accountCanHoldConnections(input.mode)) {
    return { ok: false, error: "This book does not hold exchange keys." };
  }
  const connectionId =
    input.connectionId ?? (await loadEngineSettings()).connectionId;
  if (!connectionId) {
    return {
      ok: false,
      error: "Bind an exchange in Strategy Settings before opening.",
    };
  }
  return loadBoundConnectionSecrets({
    userId: input.userId,
    accountId: input.accountId,
    connectionId,
  });
}

export function qtyTextFromFill(qty: number | null, fallback: string): string {
  if (qty !== null && qty > 0) {
    return String(Number(qty.toPrecision(12)));
  }
  return fallback;
}

export function venueOrderFields(fill: VenueFill | null | undefined) {
  if (!fill) {
    return {
      venue: null as string | null,
      environment: null as string | null,
      spotOrderId: null as string | null,
      futureOrderId: null as string | null,
      fillQty: null as number | null,
      fillSpotPrice: null as number | null,
      fillFuturePrice: null as number | null,
    };
  }
  return {
    venue: fill.venue,
    environment: fill.environment,
    spotOrderId: fill.spotOrderId,
    futureOrderId: fill.futureOrderId,
    fillQty: Number(fill.qty),
    fillSpotPrice: fill.spotPrice,
    fillFuturePrice: fill.futurePrice,
  };
}

export async function qtyTextForVenueClose(input: {
  spotSymbol: string;
  futureSymbol: string;
  orders: PaperOrderRow[];
  clipUsdt: number;
  remainingNotionalUsdt: number;
  spotAsk: number;
}): Promise<{ ok: true; qty: string } | { ok: false; error: string }> {
  const raw = closeQtyFromOpenFills({
    orders: input.orders,
    clipUsdt: input.clipUsdt,
    remainingNotionalUsdt: input.remainingNotionalUsdt,
    spotAsk: input.spotAsk,
  });
  if (raw === null) {
    return { ok: false, error: "Could not size the close on the exchange." };
  }
  const flatten =
    input.remainingNotionalUsdt > 0 &&
    input.clipUsdt >= input.remainingNotionalUsdt - 1e-9;
  if (flatten) {
    const qty = qtyTextFromFill(raw, "");
    if (!qty) {
      return { ok: false, error: "Could not size the close on the exchange." };
    }
    return { ok: true, qty };
  }
  const instruments = await loadCarryInstruments({
    spotSymbol: input.spotSymbol,
    futureSymbol: input.futureSymbol,
  });
  const floored = floorCarryQty(raw, instruments.spot, instruments.future);
  if (!floored.ok) {
    return floored;
  }
  return { ok: true, qty: floored.text };
}
