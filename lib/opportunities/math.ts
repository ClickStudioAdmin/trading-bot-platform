export type OpportunityInputs = {
  futureBid: number;
  spotAsk: number;
  feeRate: number;
  slippageRate: number;
  deliveryFeeRate: number;
  deliveryTimeMs: number;
  nowMs: number;
};

export function executableBasis(futureBid: number, spotAsk: number): number {
  if (!(spotAsk > 0) || !(futureBid > 0)) {
    throw new Error("Prices must be positive");
  }
  return (futureBid - spotAsk) / spotAsk;
}

export function daysToExpiry(deliveryTimeMs: number, nowMs: number): number {
  return (deliveryTimeMs - nowMs) / 86_400_000;
}

export function netBasis(
  execBasis: number,
  feeRate: number,
  slippageRate: number,
  deliveryFeeRate: number,
): number {
  return execBasis - feeRate - slippageRate - deliveryFeeRate;
}

export function netApr(basis: number, dte: number): number | null {
  if (!(dte > 0)) {
    return null;
  }
  return (basis * 365) / dte;
}

export function rankOpportunity(input: OpportunityInputs) {
  const exec = executableBasis(input.futureBid, input.spotAsk);
  const dte = daysToExpiry(input.deliveryTimeMs, input.nowMs);
  const net = netBasis(
    exec,
    input.feeRate,
    input.slippageRate,
    input.deliveryFeeRate,
  );
  const apr = netApr(net, dte);

  return {
    executableBasis: exec,
    daysToExpiry: dte,
    netBasis: net,
    netApr: apr,
  };
}
