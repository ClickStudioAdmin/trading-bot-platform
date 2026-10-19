const LISTED_ADMIN_EMAILS = ["click.studio.admin@gmail.com"];

export function listedAdminEmails(): string[] {
  return [...LISTED_ADMIN_EMAILS];
}

export function emailIsListedAdmin(email: string | undefined): boolean {
  if (!email) {
    return false;
  }
  return LISTED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/** Admin role, or a listed owner email. Same check as `memberIsAdmin`. */
export function loginIsAdmin(input: {
  role: string | null | undefined;
  email: string | null | undefined;
}): boolean {
  return input.role === "admin" || emailIsListedAdmin(input.email ?? undefined);
}

/** Which exchange statuses a login can use. Public is Beta and Live. */
export type ExchangePreview = "public" | "testing" | "development";

/**
 * Members see Beta and Live.
 * Platform testers also see Testing.
 * Developers and admins also see In Development.
 */
export function exchangePreviewForLogin(input: {
  role: string | null | undefined;
  email: string | null | undefined;
}): ExchangePreview {
  if (loginIsAdmin(input) || input.role === "developer") {
    return "development";
  }
  if (input.role === "platform_tester") {
    return "testing";
  }
  return "public";
}
