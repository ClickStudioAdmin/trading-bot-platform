import {
  secondFactorRecoverySelected,
  STEP_UP_FIELD,
  STEP_UP_KIND_FIELD,
  stepUpFailure,
} from "@/lib/auth/step-up";
import {
  loadMemberTotp,
  memberTotpEnabled,
} from "@/lib/auth/totp-store";
import { verifyMemberSecondFactor } from "@/lib/auth/totp-verify";

export async function stepUpError(
  userId: string,
  rawCode: unknown,
  recovery?: boolean,
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
  return stepUpFailure({ enabled, code, verified, recovery });
}

export function stepUpFromForm(
  userId: string,
  formData: FormData,
): Promise<string | null> {
  const code = formData.get(STEP_UP_FIELD);
  return stepUpError(
    userId,
    code,
    secondFactorRecoverySelected(formData.get(STEP_UP_KIND_FIELD), String(code ?? "")),
  );
}
