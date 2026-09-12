export const WELCOME_PATH = "/welcome";
export const AFFILIATES_PATH = "/affiliates";

const SKIP_ONBOARDING_PREFIXES = [
  "/api/",
  "/sign-in",
  "/pricing",
  AFFILIATES_PATH,
  WELCOME_PATH,
];

export function pathSkipsOnboarding(pathname: string): boolean {
  if (pathname === "/") {
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
    pathname === "/pricing" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/api/")
  );
}
