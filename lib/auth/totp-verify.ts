import {
  consumeRecoveryCode,
  normalizeTotpCode,
  verifyTotpCode,
} from "@/lib/auth/totp";
import {
  decryptMemberTotpSecret,
  loadMemberTotp,
  memberTotpEnabled,
  saveTotpLastStep,
  saveTotpRecoveryHashes,
  type MemberTotpRow,
} from "@/lib/auth/totp-store";

export async function verifyMemberSecondFactor(
  userId: string,
  rawCode: string,
  row?: MemberTotpRow | null,
): Promise<boolean> {
  const totp = row === undefined ? await loadMemberTotp(userId) : row;
  if (!memberTotpEnabled(totp) || !totp) {
    return false;
  }
  const totpCode = normalizeTotpCode(rawCode);
  if (totpCode) {
    const secret = decryptMemberTotpSecret(totp);
    if (secret) {
      const matched = verifyTotpCode(secret, totpCode, {
        lastStep: totp.lastStep,
      });
      if (matched) {
        await saveTotpLastStep(userId, matched.step);
        return true;
      }
    }
  }
  const remaining = consumeRecoveryCode(totp.recoveryHashes, rawCode);
  if (!remaining) {
    return false;
  }
  await saveTotpRecoveryHashes(userId, remaining);
  return true;
}
