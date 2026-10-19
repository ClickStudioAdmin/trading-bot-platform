export const TICKET_SYMBOL_COOKIES = {
  bybit: "tbp.ticket.bybit",
  hyperliquid: "tbp.ticket.hl",
} as const;

/** Keep a saved contract only when it is still in the ticket list. */
export function ticketSymbolFromCookie(
  raw: string | undefined,
  options: readonly { symbol: string }[],
  fallback: string,
): string {
  const symbol = decodeURIComponent(String(raw ?? "").trim());
  if (!symbol) {
    return fallback;
  }
  return options.some((row) => row.symbol === symbol) ? symbol : fallback;
}
