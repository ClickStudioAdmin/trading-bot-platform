export const STEP_UP_FIELD = "totpCode";

export const STEP_UP_MISSING =
  "Enter a Google Authenticator or recovery code.";

export const STEP_UP_INVALID =
  "That Google Authenticator or recovery code is incorrect.";

/** When 2FA is off, the submit stands. When it is on, this code must verify. */
export function stepUpFailure(input: {
  enabled: boolean;
  code: string;
  verified: boolean;
}): string | null {
  if (!input.enabled) {
    return null;
  }
  if (!input.code.trim()) {
    return STEP_UP_MISSING;
  }
  if (!input.verified) {
    return STEP_UP_INVALID;
  }
  return null;
}

/** Bio, logo, and an unchanged alias stay on the session. */
export function traderAliasNeedsStepUp(
  previousAlias: string | null,
  nextAlias: string,
): boolean {
  return (previousAlias ?? "") !== nextAlias;
}
