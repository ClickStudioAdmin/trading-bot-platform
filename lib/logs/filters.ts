import { firstSearchValue } from "@/lib/paper/open";

export type EventLogFilters = {
  scope: string;
  level: string;
  event: string;
  account?: string;
  bot?: string;
};

export function parseEventLogFilters(
  params: Record<string, string | string[] | undefined>,
): EventLogFilters {
  return {
    scope: firstSearchValue(params.scope) ?? "",
    level: firstSearchValue(params.level) ?? "",
    event: firstSearchValue(params.event) ?? "",
    account: firstSearchValue(params.account) ?? "",
    bot: eventLogBotId(firstSearchValue(params.bot) ?? ""),
  };
}

export function eventLogBotId(raw: string): string {
  const id = raw.trim();
  return /^[A-Za-z0-9_-]{1,80}$/.test(id) ? id : "";
}
