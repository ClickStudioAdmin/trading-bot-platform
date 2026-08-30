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
