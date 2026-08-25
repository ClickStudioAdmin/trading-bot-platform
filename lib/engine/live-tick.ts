import type { TradingAccountMode } from "@/lib/accounts/model";
import {
  closeCashAndCarryOnVenue,
  openCashAndCarryOnVenue,
  type VenueFill,
} from "@/lib/exchanges/execute";
import {
  loadBoundVenueForAccount,
  qtyTextForVenueClose,
} from "@/lib/exchanges/live-trade";
import type { BoundConnectionSecrets } from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import type { PaperOrderRow } from "@/lib/paper/orders";
import type { PaperCarryRow } from "@/lib/paper/rows";

export async function boundVenueForTick(input: {
  userId: string;
  accountId: string;
  mode: string;
  connectionId: string | null;
}): Promise<
  | { live: false }
  | { live: true; ok: true; connection: BoundConnectionSecrets }
  | { live: true; ok: false; error: string }
> {
  if (!accountCanHoldConnections(input.mode)) {
    return { live: false };
  }
  const bound = await loadBoundVenueForAccount({
    userId: input.userId,
    accountId: input.accountId,
    mode: input.mode as TradingAccountMode,
    connectionId: input.connectionId,
  });
  if (!bound.ok) {
    return { live: true, ok: false, error: bound.error };
  }
  return { live: true, ok: true, connection: bound.connection };
}

export async function openLiveCarry(input: {
  connection: BoundConnectionSecrets;
  opportunity: ScannedOpportunity;
  notionalUsdt: number;
}): Promise<{ ok: true; fill: VenueFill } | { ok: false; error: string }> {
  return openCashAndCarryOnVenue({
    connection: input.connection,
    spotSymbol: input.opportunity.spotSymbol,
    futureSymbol: input.opportunity.futureSymbol,
    spotAsk: input.opportunity.spotAsk,
    notionalUsdt: input.notionalUsdt,
  });
}

export async function flattenLiveOpen(input: {
  connection: BoundConnectionSecrets;
  opportunity: ScannedOpportunity;
  qty: string;
}) {
  return closeCashAndCarryOnVenue({
    connection: input.connection,
    spotSymbol: input.opportunity.spotSymbol,
    futureSymbol: input.opportunity.futureSymbol,
    qty: input.qty,
  });
}

export async function closeLiveCarry(input: {
  connection: BoundConnectionSecrets;
  row: PaperCarryRow;
  opportunity: ScannedOpportunity;
  orders: PaperOrderRow[];
  clipUsdt: number;
}): Promise<{ ok: true; fill: VenueFill } | { ok: false; error: string }> {
  const qty = await qtyTextForVenueClose({
    spotSymbol: input.row.spotSymbol,
    futureSymbol: input.row.futureSymbol,
    orders: input.orders,
    clipUsdt: input.clipUsdt,
    remainingNotionalUsdt: input.row.notionalUsdt,
    spotAsk: input.opportunity.spotAsk,
  });
  if (!qty.ok) {
    return qty;
  }
  return closeCashAndCarryOnVenue({
    connection: input.connection,
    spotSymbol: input.row.spotSymbol,
    futureSymbol: input.row.futureSymbol,
    qty: qty.qty,
  });
}
