import type { FuturesAction, FuturesSide } from "@/lib/futures/model";
import type { FuturesDecision, OpenFutures } from "@/lib/futures/decide";

export function decideHyperliquidAction(input: {
  action: FuturesAction;
  open: OpenFutures | null;
  reduceOnly: boolean;
}): FuturesDecision {
  if (input.action === "flatten") {
    if (!input.open) {
      return { ok: false, error: "There is no open position to close." };
    }
    return {
      ok: true,
      kind: "flatten",
      positionSide: input.open.side,
      orderSide: input.open.side === "long" ? "Sell" : "Buy",
      reduceOnly: true,
      qty: input.open.qty,
    };
  }

  if (input.reduceOnly) {
    return {
      ok: false,
      error: "Reduce only is on. Close still works; Buy and Sell do not.",
    };
  }

  const positionSide: FuturesSide = input.action === "buy" ? "long" : "short";
  const orderSide = input.action === "buy" ? "Buy" : "Sell";

  if (!input.open) {
    return {
      ok: true,
      kind: "open",
      positionSide,
      orderSide,
      reduceOnly: false,
    };
  }

  if (input.open.side === positionSide) {
    return {
      ok: true,
      kind: "add",
      positionSide,
      orderSide,
      reduceOnly: false,
    };
  }

  return {
    ok: false,
    error: "This desk is one-way. Close or reduce the other side first.",
  };
}

export function hyperliquidOppositeRow<T extends { side: FuturesSide }>(
  opens: readonly T[],
  wantedSide: FuturesSide,
): T | null {
  return opens.find((row) => row.side !== wantedSide) ?? null;
}
