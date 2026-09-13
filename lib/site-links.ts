export const PUBLIC_NAV_LINKS = [
  { href: "/", label: "Home", exact: true },
  { href: "/#how-it-works", label: "How it works", exact: false },
  { href: "/pricing", label: "Pricing", exact: false },
  { href: "/affiliates", label: "Affiliates", exact: false },
] as const;

export const HEADER_LINKS = [
  { href: "/account/copy", label: "Copy Trading" },
  { href: "/account/backtests", label: "Backtesting Tool" },
  { href: "/account/plans", label: "Plans" },
  { href: "/affiliates", label: "Affiliates" },
] as const;

export const AFFILIATE_ONLY_HEADER_LINKS = [
  { href: "/affiliates", label: "Affiliates" },
] as const;

export function isAppChromePath(pathname: string): boolean {
  return (
    pathname.startsWith("/account") ||
    pathname.startsWith("/strategies") ||
    pathname.startsWith("/admin")
  );
}

export function isAffiliatePortalPath(pathname: string): boolean {
  return pathname === "/affiliates" || pathname.startsWith("/affiliates/");
}

export function usesSignedInAppChrome(
  pathname: string,
  signedIn: boolean,
): boolean {
  return isAppChromePath(pathname) || (signedIn && isAffiliatePortalPath(pathname));
}

export const STRATEGY_LINKS = [
  { href: "/strategies/cash-and-carry", label: "Cash and Carry" },
  { href: "/strategies/futures", label: "Futures" },
] as const;

export const CASH_AND_CARRY_PRIMARY_LINKS = [
  { href: "/strategies/cash-and-carry/positions", label: "Positions" },
  { href: "/strategies/cash-and-carry/automations", label: "Automations (bots)" },
  { href: "/strategies/cash-and-carry/performance", label: "Performance" },
] as const;

export const CASH_AND_CARRY_SECONDARY_LINKS = [
  { href: "/strategies/cash-and-carry/settings", label: "Desk Settings" },
  { href: "/strategies/cash-and-carry/opportunities", label: "Opportunities" },
  { href: "/strategies/cash-and-carry/pairs", label: "Pairs" },
  { href: "/strategies/cash-and-carry/activity", label: "Activity" },
] as const;

export const ADMIN_NAV_LINKS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/billing", label: "Billing & Wallets" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/affiliates", label: "Affiliates" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/admin/theme", label: "Theme" },
] as const;

export const ACCOUNT_DESK_LINKS = [
  { href: "/account", label: "Overview", exact: true },
  { href: "/account/settings", label: "Settings", exact: true },
  { href: "/account/billing", label: "Billing and Wallets", exact: false },
  { href: "/account/exchanges", label: "Exchanges", exact: true },
  { href: "/account/sub-accounts", label: "Manage Desks", exact: true },
  { href: "/account/templates", label: "Bot Templates", exact: true },
] as const;

export const AFFILIATE_ONLY_LINKS = [
  { href: "/account/settings", label: "Settings", exact: true },
] as const;

export const FUTURES_PRIMARY_LINKS = [
  { href: "/strategies/futures/positions", label: "Positions" },
  { href: "/strategies/futures/automations", label: "Automations (bots)" },
  { href: "/strategies/futures/webhooks", label: "Webhooks" },
  { href: "/strategies/futures/performance", label: "Performance" },
] as const;

export const PERPS_PRIMARY_LINKS = [
  { href: "/strategies/futures/positions", label: "Positions" },
  { href: "/strategies/futures/performance", label: "Performance" },
] as const;

export const PERPS_BOTS_PRIMARY_LINKS = [
  { href: "/strategies/futures/positions", label: "Positions" },
  { href: "/strategies/futures/automations", label: "Automations (bots)" },
  { href: "/strategies/futures/webhooks", label: "Webhooks" },
  { href: "/strategies/futures/performance", label: "Performance" },
] as const;

export const SIGNAL_FOLLOWER_PRIMARY_LINKS = [
  { href: "/strategies/futures/positions", label: "Positions" },
  { href: "/strategies/futures/webhooks", label: "Webhooks" },
  { href: "/strategies/futures/performance", label: "Performance" },
] as const;

export const COPY_PRIMARY_LINKS = PERPS_PRIMARY_LINKS;

export const FUTURES_SECONDARY_LINKS = [
  { href: "/strategies/futures/shared", label: "Manage Copy Traders" },
  { href: "/strategies/futures/settings", label: "Desk Settings" },
  { href: "/strategies/futures/pairs", label: "Pairs" },
  { href: "/strategies/futures/activity", label: "Activity" },
] as const;

export const ACCOUNT_BOOK_LINKS = [
  { href: "/account/book", label: "Overview", exact: true },
] as const;

