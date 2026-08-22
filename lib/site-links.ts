export const SITE_LINKS = [
  { href: "/strategies", label: "Strategies" },
] as const;

export const CASH_AND_CARRY_PRIMARY_LINKS = [
  { href: "/strategies/cash-and-carry", label: "Overview", exact: true },
  { href: "/strategies/cash-and-carry/opportunities", label: "Opportunities" },
  { href: "/strategies/cash-and-carry/positions", label: "Positions" },
  { href: "/strategies/cash-and-carry/automations", label: "Automations" },
] as const;

export const CASH_AND_CARRY_SECONDARY_LINKS = [
  { href: "/strategies/cash-and-carry/pairs", label: "Pairs" },
  { href: "/strategies/cash-and-carry/settings", label: "Settings" },
] as const;

export const CASH_AND_CARRY_LINKS = [
  ...CASH_AND_CARRY_PRIMARY_LINKS,
  ...CASH_AND_CARRY_SECONDARY_LINKS,
] as const;
