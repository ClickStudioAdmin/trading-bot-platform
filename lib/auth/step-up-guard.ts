import { STEP_UP_FIELD, stepUpFailure } from "@/lib/auth/step-up";
import {
  loadMemberTotp,
  memberTotpEnabled,
} from "@/lib/auth/totp-store";
import { verifyMemberSecondFactor } from "@/lib/auth/totp-verify";

export async function stepUpError(
  userId: string,
  rawCode: unknown,
): Promise<string | null> {
  const totp = await loadMemberTotp(userId);
  const enabled = memberTotpEnabled(totp);
  const code = String(rawCode ?? "");
  if (!enabled) {
    return null;
  }
  const verified = code.trim()
    ? await verifyMemberSecondFactor(userId, code, totp)
    : false;
  return stepUpFailure({ enabled, code, verified });
}

export function stepUpFromForm(
  userId: string,
  formData: FormData,
): Promise<string | null> {
  return stepUpError(userId, formData.get(STEP_UP_FIELD));
}
