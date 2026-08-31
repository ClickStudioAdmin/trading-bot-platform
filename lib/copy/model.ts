export const DEFAULT_COPY_MIN_ACTIVITY_DAYS = 90;
export const MS_PER_DAY = 86_400_000;

export function parseCopyMinActivityDays(
  value: unknown,
): { ok: true; days: number } | { ok: false; error: string } {
  const raw = String(value ?? "").trim().replace(/,/g, "");
  if (!raw) {
    return { ok: false, error: "Enter the minimum activity days." };
  }
  if (!/^\d+$/.test(raw)) {
    return { ok: false, error: "Minimum activity days must be a whole number." };
  }
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 0) {
    return { ok: false, error: "Minimum activity days must be zero or more." };
  }
  return { ok: true, days };
}

export function copyActivityFloorMet(input: {
  firstFillMs: number | null | undefined;
  minDays: number;
  nowMs: number;
}): boolean {
  if (
    input.firstFillMs == null ||
    !Number.isFinite(input.firstFillMs) ||
    !Number.isFinite(input.minDays) ||
    input.minDays < 0 ||
    !Number.isFinite(input.nowMs)
  ) {
    return false;
  }
  if (input.nowMs < input.firstFillMs) {
    return false;
  }
  return input.nowMs - input.firstFillMs >= input.minDays * MS_PER_DAY;
}
