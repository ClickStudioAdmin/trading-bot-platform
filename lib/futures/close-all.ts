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
