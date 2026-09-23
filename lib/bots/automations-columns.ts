import {
  parseColumnFlags,
  parseStoredColumnFlags,
} from "@/lib/table-columns";

export const AUTOMATIONS_OPTIONAL_COLUMNS = [
  "pair",
  "recipe",
  "positions",
  "performance",
  "status",
] as const;

export type AutomationsOptionalColumn =
  (typeof AUTOMATIONS_OPTIONAL_COLUMNS)[number];

export type AutomationsColumnVisibility = Record<
  AutomationsOptionalColumn,
  boolean
>;

export const AUTOMATIONS_COLUMNS_KEY = "tbp-columns:automations-bots";

export const AUTOMATIONS_COLUMN_LABELS: Record<
  AutomationsOptionalColumn,
  string
> = {
  pair: "Pair",
  recipe: "Side / Recipe",
  status: "Status",
  positions: "Positions",
  performance: "Performance",
};

export const AUTOMATIONS_COLUMN_DEFAULTS: AutomationsColumnVisibility = {
  pair: true,
  recipe: true,
  status: true,
  positions: true,
  performance: true,
};

export function parseAutomationsColumns(
  raw: unknown,
): AutomationsColumnVisibility {
  return parseColumnFlags(
    raw,
    AUTOMATIONS_OPTIONAL_COLUMNS,
    AUTOMATIONS_COLUMN_DEFAULTS,
  );
}

export function parseStoredAutomationsColumns(
  raw: string | null,
): AutomationsColumnVisibility {
  return parseStoredColumnFlags(
    raw,
    AUTOMATIONS_OPTIONAL_COLUMNS,
    AUTOMATIONS_COLUMN_DEFAULTS,
  );
}
