export const VERIFY_CODE_DIGIT_LIMIT = 6;

export function clampVerifyCodeDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, VERIFY_CODE_DIGIT_LIMIT);
}
