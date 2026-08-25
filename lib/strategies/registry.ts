export const CASH_AND_CARRY_STRATEGY_ID = "cash-and-carry";
export const FUTURES_STRATEGY_ID = "futures";

export type StrategyId =
  | typeof CASH_AND_CARRY_STRATEGY_ID
  | typeof FUTURES_STRATEGY_ID;

export const FUTURES_PATHS = {
  root: "/strategies/futures",
  positions: "/strategies/futures/positions",
  automations: "/strategies/futures/automations",
  performance: "/strategies/futures/performance",
  settings: "/strategies/futures/settings",
} as const;
