import { totpDigitsComplete } from "@/lib/auth/totp-digits";

export const STEP_UP_FIELD = "totpCode";
export const STEP_UP_KIND_FIELD = "totpKind";

export const AUTHENTICATOR_CODE_LABEL = "Authenticator code";
export const RECOVERY_CODE_LABEL = "Recovery code";
export const AUTHENTICATOR_CODE_HINT = "Google Authenticator code.";
export const RECOVERY_CODE_HINT = "This code works once.";
export const USE_RECOVERY_CODE = "Use a recovery code";
export const USE_AUTHENTICATOR_CODE = "Use Google Authenticator";

export const STEP_UP_MISSING = "Enter the Google Authenticator code.";
export const STEP_UP_INVALID = "That Google Authenticator code is incorrect.";
export const STEP_UP_RECOVERY_MISSING = "Enter a recovery code.";
export const STEP_UP_RECOVERY_INVALID = "That recovery code is incorrect.";

/** A non-empty value that is not six digits is a recovery code. */
export function secondFactorUsesRecovery(code: string): boolean {
  const trimmed = code.trim();
  return trimmed.length > 0 && !totpDigitsComplete(trimmed);
}

/**
 * The form records the method the member selected. Without that field,
 * a recovery-shaped code is the recovery method.
 */
export function secondFactorRecoverySelected(
  kind: unknown,
  code: string,
): boolean {
  if (kind === "recovery") {
    return true;
  }
  if (kind === "authenticator") {
    return false;
  }
  return secondFactorUsesRecovery(code);
}

export function secondFactorMissingMessage(recovery: boolean): string {
  return recovery ? STEP_UP_RECOVERY_MISSING : STEP_UP_MISSING;
}

export function secondFactorInvalidMessage(recovery: boolean): string {
  return recovery ? STEP_UP_RECOVERY_INVALID : STEP_UP_INVALID;
}

export function secondFactorPasswordMessage(recovery: boolean): string {
  return recovery
    ? "Enter your password and a recovery code."
    : "Enter your password and the Google Authenticator code.";
}

/** Shown on the dialog when the submit dies before it can answer. */
export const STEP_UP_REQUEST_FAILED = "That request timed out. Try again.";

const NEXT_CONTROL_PREFIXES = [
  "NEXT_REDIRECT",
  "NEXT_HTTP_ERROR_FALLBACK",
  "NEXT_NOT_FOUND",
];

/** Redirects and not-found must leave the dialog. Other failures stay on it. */
export function rethrowNextControlFlow(error: unknown): void {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return;
  }
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string") {
    return;
  }
  if (NEXT_CONTROL_PREFIXES.some((prefix) => digest.startsWith(prefix))) {
    throw error;
  }
}

/** When 2FA is off, the submit stands. When it is on, this code must verify. */
export function stepUpFailure(input: {
  enabled: boolean;
  code: string;
  verified: boolean;
  recovery?: boolean;
}): string | null {
  if (!input.enabled) {
    return null;
  }
  const recovery =
    input.recovery ?? secondFactorUsesRecovery(input.code);
  if (!input.code.trim()) {
    return secondFactorMissingMessage(recovery);
  }
  if (!input.verified) {
    return secondFactorInvalidMessage(recovery);
  }
  return null;
}

/**
 * The page does not show a code field. Ask in the modal when 2FA is on,
 * this submit still needs a code, and the form does not have one yet.
 */
export function stepUpShouldAsk(input: {
  enabled: boolean;
  code: string;
  aliasUnchanged?: boolean;
}): boolean {
  if (!input.enabled || input.aliasUnchanged) {
    return false;
  }
  return input.code.trim() === "";
}

/** A wrong code stays on the step-up modal. Redirecting would close it. */
export function stepUpRejection(message: string): { stepUpError: string } {
  return { stepUpError: message };
}

export function stepUpRejectionMessage(result: unknown): string | null {
  if (typeof result !== "object" || result === null || !("stepUpError" in result)) {
    return null;
  }
  const message = (result as { stepUpError?: unknown }).stepUpError;
  if (typeof message !== "string") {
    return null;
  }
  const trimmed = message.trim();
  return trimmed || null;
}

/** Bio, logo, and an unchanged alias stay on the session. */
export function traderAliasNeedsStepUp(
  previousAlias: string | null,
  nextAlias: string,
): boolean {
  return (previousAlias ?? "") !== nextAlias;
}
