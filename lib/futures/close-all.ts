export const CLOSE_ALL_CONFIRM = "CLOSE ALL";

export function parseCloseAllConfirm(
  raw: unknown,
): { ok: true } | { ok: false; error: string } {
  if (String(raw ?? "").trim() !== CLOSE_ALL_CONFIRM) {
    return {
      ok: false,
      error: `Type ${CLOSE_ALL_CONFIRM} to confirm.`,
    };
  }
  return { ok: true };
}

export function closeAllFlash(input: {
  live: boolean;
  closedCount: number;
}): "live-closed-all" | "closed-all" | "cancelled" {
  if (input.closedCount > 0) {
    return input.live ? "live-closed-all" : "closed-all";
  }
  return "cancelled";
}
