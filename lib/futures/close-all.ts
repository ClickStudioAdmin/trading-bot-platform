export type CloseAllScope = "positions" | "orders" | "all";

export const CLOSE_ALL_CONFIRM = "CLOSE ALL";
export const CANCEL_ALL_CONFIRM = "CANCEL ALL";

export function parseCloseAllScope(
  raw: unknown,
): { ok: true; scope: CloseAllScope } | { ok: false; error: string } {
  const scope = String(raw ?? "").trim();
  if (scope === "positions" || scope === "orders" || scope === "all") {
    return { ok: true, scope };
  }
  return { ok: false, error: "Choose Close All, Cancel All, or both." };
}

export function confirmPhraseForScope(scope: CloseAllScope): string {
  return scope === "orders" ? CANCEL_ALL_CONFIRM : CLOSE_ALL_CONFIRM;
}

export function parseSetReduceOnly(raw: unknown): boolean {
  const value = String(raw ?? "").trim().toLowerCase();
  return value === "on" || value === "true" || value === "1";
}

export function parseCloseAllConfirm(
  raw: unknown,
  scope: CloseAllScope = "all",
): { ok: true } | { ok: false; error: string } {
  const phrase = confirmPhraseForScope(scope);
  if (String(raw ?? "").trim() !== phrase) {
    return {
      ok: false,
      error: `Type ${phrase} to confirm.`,
    };
  }
  return { ok: true };
}

export function closeAllScopeBody(scope: CloseAllScope): string {
  if (scope === "positions") {
    return "Market-closes every open position at full size. Working orders stay, except a leftover reduce-only close limit on a row that fully closes. Rows show Closing until the venue confirms. This cannot be undone.";
  }
  if (scope === "orders") {
    return "Cancels every open working order on this book. Open positions stay. Rows show Cancelling until the venue confirms. This cannot be undone.";
  }
  return "Cancels open working orders and market-closes every open position. Rows show Closing / Cancelling until the venue confirms. This cannot be undone.";
}

export function closeAllExtraBody(input: {
  copyDesk?: boolean;
  dcaDesk?: boolean;
}): string | null {
  if (input.copyDesk) {
    return "This desk has no bot to idle. Copied limits cancel and positions close at market.";
  }
  if (input.dcaDesk) {
    return "The bot stays Active and can start a new cycle after the row is gone. Stop adding or Disable it on Automations if you do not want that.";
  }
  return null;
}

export function closeAllBlockNewSizeCopy(input: { dcaDesk?: boolean }): {
  label: string;
  hint: string;
} {
  if (input.dcaDesk) {
    return {
      label: "Block new clips",
      hint: "Turns on Reduce only in Desk Settings so this Active bot cannot place a new first order or adds. It does not Stop adding or Disable the bot.",
    };
  }
  return {
    label: "Set reduce only",
    hint: "Blocks Buy and Sell on this book so size cannot come back. Active automation rules also switch to Reduce only.",
  };
}

export function closeAllFlash(input: {
  live: boolean;
  closedCount: number;
  cancelledCount: number;
}):
  | "live-closed-and-cancelled"
  | "closed-and-cancelled"
  | "live-closed-all"
  | "closed-all"
  | "cancelled-all" {
  if (input.closedCount > 0 && input.cancelledCount > 0) {
    return input.live ? "live-closed-and-cancelled" : "closed-and-cancelled";
  }
  if (input.closedCount > 0) {
    return input.live ? "live-closed-all" : "closed-all";
  }
  return "cancelled-all";
}
