export const SITE_LINKS = [
  { href: "/strategies", label: "Strategies" },
] as const;

export const CASH_AND_CARRY_PRIMARY_LINKS = [
  { href: "/strategies/cash-and-carry", label: "Overview", exact: true },
  { href: "/strategies/cash-and-carry/opportunities", label: "Opportunities" },
  { href: "/strategies/cash-and-carry/positions", label: "Positions" },
  { href: "/strategies/cash-and-carry/automations", label: "Automations" },
  { href: "/strategies/cash-and-carry/performance", label: "Performance" },
] as const;

export const CASH_AND_CARRY_SECONDARY_LINKS = [
  { href: "/strategies/cash-and-carry/settings", label: "Strategy Settings" },
  { href: "/strategies/cash-and-carry/activity", label: "Activity" },
  { href: "/strategies/cash-and-carry/pairs", label: "Pairs" },
] as const;

export const ADMIN_NAV_LINKS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/admin/theme", label: "Theme" },
] as const;

export const ACCOUNT_DESK_LINKS = [
  { href: "/account", label: "Overview", exact: true },
  { href: "/account/settings", label: "Settings", exact: true },
  { href: "/account/sub-accounts", label: "Manage sub-accounts", exact: true },
] as const;

export const FUTURES_PRIMARY_LINKS = [
  { href: "/strategies/futures", label: "Overview", exact: true },
  { href: "/strategies/futures/positions", label: "Positions" },
] as const;

export const FUTURES_SECONDARY_LINKS = [
  { href: "/strategies/futures/settings", label: "Strategy Settings" },
] as const;

export const ACCOUNT_BOOK_LINKS = [
  { href: "/account/book", label: "Overview", exact: true },
  { href: "/account/exchanges", label: "Exchanges", exact: true },
] as const;

