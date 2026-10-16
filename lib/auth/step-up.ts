export const STEP_UP_FIELD = "totpCode";

export const STEP_UP_MISSING =
  "Enter a Google Authenticator or recovery code.";

export const STEP_UP_INVALID =
  "That Google Authenticator or recovery code is incorrect.";

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
