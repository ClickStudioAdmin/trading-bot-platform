export const WELCOME_PATH = "/welcome";
export const AFFILIATES_PATH = "/affiliates";
export const SIGN_UP_PATH = "/sign-up";

const SKIP_ONBOARDING_PREFIXES = [
  "/api/",
  "/sign-in",
  SIGN_UP_PATH,
  "/pricing",
  AFFILIATES_PATH,
  WELCOME_PATH,
];

export function pathSkipsOnboarding(pathname: string): boolean {
  if (pathname === "/" || pathname === "/r" || pathname.startsWith("/r/")) {
    return true;
  }
  return SKIP_ONBOARDING_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}

export function pathAllowsAffiliateOnly(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === AFFILIATES_PATH ||
    pathname.startsWith(`${AFFILIATES_PATH}/`) ||
    pathname === "/account/settings" ||
    pathname.startsWith("/account/settings/") ||
    pathname === "/pricing" ||
    pathname.startsWith("/sign-in") ||
    pathname === SIGN_UP_PATH ||
    pathname.startsWith(`${SIGN_UP_PATH}/`) ||
    pathname.startsWith("/api/") ||
    pathname === "/r" ||
    pathname.startsWith("/r/")
  );
}
