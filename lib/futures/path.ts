import { FUTURES_PATHS } from "@/lib/strategies/registry";

export type FuturesReturnPath =
  | typeof FUTURES_PATHS.root
  | typeof FUTURES_PATHS.positions;

export function safeFuturesReturnPath(raw: string): FuturesReturnPath {
  if (raw === FUTURES_PATHS.root || raw === FUTURES_PATHS.positions) {
    return raw;
  }
  return FUTURES_PATHS.positions;
}
