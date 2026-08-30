import { firstSearchValue } from "@/lib/paper/open";

export type EventLogFilters = {
  scope: string;
  level: string;
  event: string;
  account?: string;
};

export function parseEventLogFilters(
  params: Record<string, string | string[] | undefined>,
): EventLogFilters {
  return {
    scope: firstSearchValue(params.scope) ?? "",
    level: firstSearchValue(params.level) ?? "",
    event: firstSearchValue(params.event) ?? "",
    account: firstSearchValue(params.account) ?? "",
  };
}
