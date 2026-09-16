export const ACCOUNT_HOME_PATH = "/account";
export const VERIFY_PATH = "/account/verify";
export const VERIFY_EMAIL_PATH = "/verify-email";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";
export const AFFILIATES_PATH = "/affiliates";
export const SIGN_UP_PATH = "/sign-up";
export const SIGN_IN_PATH = "/sign-in";
export const SIGN_IN_2FA_PATH = "/sign-in/2fa";

const UNVERIFIED_PREFIXES = [
  "/api/",
  SIGN_IN_PATH,
  SIGN_UP_PATH,
  "/sign-out",
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
  VERIFY_EMAIL_PATH,
  VERIFY_PATH,
  "/pricing",
];

const AFFILIATE_ONLY_PREFIXES = [
  AFFILIATES_PATH,
  "/account/settings",
  "/account/notifications",
  "/pricing",
  SIGN_IN_PATH,
  SIGN_UP_PATH,
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
  VERIFY_EMAIL_PATH,
  VERIFY_PATH,
  "/api/",
];

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  if (pathname === prefix) {
    return true;
  }
  const root = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return pathname.startsWith(root);
}

export function pathAllowsUnverified(pathname: string): boolean {
  if (pathname === "/" || pathname === "/r" || pathname.startsWith("/r/")) {
    return true;
  }
  return UNVERIFIED_PREFIXES.some((prefix) =>
    pathMatchesPrefix(pathname, prefix),
  );
}

export function pathAllowsAffiliateOnly(pathname: string): boolean {
  if (pathname === "/" || pathname === "/r" || pathname.startsWith("/r/")) {
    return true;
  }
  return AFFILIATE_ONLY_PREFIXES.some((prefix) =>
    pathMatchesPrefix(pathname, prefix),
  );
}
