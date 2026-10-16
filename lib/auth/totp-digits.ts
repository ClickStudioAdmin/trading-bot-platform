export const TOTP_DIGIT_COUNT = 6;

export function clampTotpCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, TOTP_DIGIT_COUNT);
}

export function totpDigitsComplete(code: string): boolean {
  return new RegExp(`^\\d{${TOTP_DIGIT_COUNT}}$`).test(code);
}
