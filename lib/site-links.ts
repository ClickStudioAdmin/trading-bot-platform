export const SITE_LINKS = [
  { href: "/strategies", label: "Desks" },
] as const;

export function isAppChromePath(pathname: string): boolean {
  return (
    pathname.startsWith("/account") ||
    pathname.startsWith("/strategies") ||
    pathname.startsWith("/admin")
  );
}

export const STRATEGY_LINKS = [
  { href: "/strategies/cash-and-carry", label: "Cash and Carry" },
  { href: "/strategies/futures", label: "Futures" },
] as const;

export const CASH_AND_CARRY_PRIMARY_LINKS = [
  { href: "/strategies/cash-and-carry", label: "Overview", exact: true },
  { href: "/strategies/cash-and-carry/positions", label: "Positions" },
  { href: "/strategies/cash-and-carry/automations", label: "Automations (bots)" },
  { href: "/strategies/cash-and-carry/performance", label: "Performance" },
] as const;

export const CASH_AND_CARRY_SECONDARY_LINKS = [
  { href: "/strategies/cash-and-carry/settings", label: "Desk Settings" },
  { href: "/strategies/cash-and-carry/activity", label: "Activity" },
  { href: "/strategies/cash-and-carry/opportunities", label: "Opportunities" },
  { href: "/strategies/cash-and-carry/pairs", label: "Pairs" },
] as const;

export const ADMIN_NAV_LINKS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/admin/theme", label: "Theme" },
] as const;

export const ACCOUNT_DESK_LINKS = [
  { href: "/account", label: "Overview", exact: true },
  { href: "/account/settings", label: "Settings", exact: true },
  { href: "/account/exchanges", label: "Exchanges", exact: true },
  { href: "/account/sub-accounts", label: "Manage desks", exact: true },
  { href: "/account/templates", label: "Bot Templates", exact: true },
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
  { href: "/strategies/futures/performance", label: "Performance" },
] as const;

export const SIGNAL_FOLLOWER_PRIMARY_LINKS = [
  { href: "/strategies/futures/positions", label: "Positions" },
  { href: "/strategies/futures/webhooks", label: "Webhooks" },
  { href: "/strategies/futures/performance", label: "Performance" },
] as const;

export const FUTURES_SECONDARY_LINKS = [
  { href: "/strategies/futures/settings", label: "Desk Settings" },
  { href: "/strategies/futures/activity", label: "Activity" },
  { href: "/strategies/futures/pairs", label: "Pairs" },
] as const;

export const ACCOUNT_BOOK_LINKS = [
  { href: "/account/book", label: "Overview", exact: true },
] as const;

