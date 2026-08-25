import type { FuturesAction, FuturesSide } from "./model";

export type OpenFutures = {
  side: FuturesSide;
  qty: number;
};

export type FuturesDecision =
  | {
      ok: true;
      kind: "open" | "add";
      positionSide: FuturesSide;
      orderSide: "Buy" | "Sell";
      reduceOnly: false;
    }
  | {
      ok: true;
      kind: "flatten";
      positionSide: FuturesSide;
      orderSide: "Buy" | "Sell";
      reduceOnly: true;
      qty: number;
    }
  | { ok: false; error: string };

export function hedgePositionIdx(side: FuturesSide): 1 | 2 {
  return side === "long" ? 1 : 2;
}

export function decideFuturesAction(input: {
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

  if (input.open.side !== positionSide) {
    return {
      ok: false,
      error: "Could not match that order to an open row.",
    };
  }

  return {
    ok: true,
    kind: "add",
    positionSide,
    orderSide,
    reduceOnly: false,
  };
}
