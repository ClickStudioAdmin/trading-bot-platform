import { hrefPathname, withDeskFrom } from "@/lib/accounts/model";
import { FUTURES_PATHS } from "@/lib/strategies/registry";

export type FuturesReturnPath =
  | typeof FUTURES_PATHS.root
  | typeof FUTURES_PATHS.positions
  | typeof FUTURES_PATHS.webhooks;

export function safeFuturesReturnPath(raw: string): string {
  const pathname = hrefPathname(raw);
  const base: FuturesReturnPath =
    pathname === FUTURES_PATHS.root ||
    pathname === FUTURES_PATHS.positions ||
    pathname === FUTURES_PATHS.webhooks
      ? pathname
      : FUTURES_PATHS.positions;
  return withDeskFrom(base, raw);
}
