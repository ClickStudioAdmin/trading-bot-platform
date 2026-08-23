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
  { href: "/strategies/cash-and-carry/settings", label: "Settings" },
  { href: "/strategies/cash-and-carry/activity", label: "Activity" },
  { href: "/strategies/cash-and-carry/pairs", label: "Pairs" },
] as const;

export const ADMIN_NAV_LINKS = [
  { href: "/admin/members", label: "Members" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/admin/theme", label: "Theme" },
] as const;

export const ACCOUNT_NAV_LINKS = [
  { href: "/account/settings", label: "Settings", exact: true },
  { href: "/account", label: "Manage sub-accounts", exact: true },
  { href: "/account/exchanges", label: "Exchanges", exact: true },
] as const;

