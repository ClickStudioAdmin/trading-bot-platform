export type DeskActionResult = {
  ok: boolean;
  error?: string;
  notice?: string;
};

export function deskActionError(error: string): DeskActionResult {
  return { ok: false, error };
}

export function deskActionOk(
  notice?: string,
  extra?: Omit<DeskActionResult, "ok" | "notice">,
): DeskActionResult {
  return { ok: true, notice, ...extra };
}
