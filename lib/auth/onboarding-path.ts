export const WELCOME_PATH = "/welcome";

const SKIP_ONBOARDING_PREFIXES = ["/api/", "/sign-in", WELCOME_PATH];

export function pathSkipsOnboarding(pathname: string): boolean {
  return SKIP_ONBOARDING_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}
