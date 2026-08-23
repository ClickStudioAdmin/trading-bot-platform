export const EVENT_LOG_OPTIONS = [
  { event: "account.created", scope: "system" },
  { event: "account.deleted", scope: "system" },
  { event: "automations.save_failed", scope: "strategy" },
  { event: "automations.saved", scope: "strategy" },
  { event: "engine.close_failed", scope: "trade" },
  { event: "engine.open_failed", scope: "trade" },
  { event: "engine.tick", scope: "system" },
  { event: "engine.tick_admin", scope: "system" },
  { event: "member.created", scope: "system" },
  { event: "member.updated", scope: "system" },
  { event: "settings.save_failed", scope: "strategy" },
  { event: "settings.saved", scope: "strategy" },
  { event: "trade.added", scope: "trade" },
  { event: "trade.closed", scope: "trade" },
  { event: "trade.close_failed", scope: "trade" },
  { event: "trade.exits_failed", scope: "trade" },
  { event: "trade.exits_updated", scope: "trade" },
  { event: "trade.opened", scope: "trade" },
  { event: "trade.open_failed", scope: "trade" },
  { event: "trade.order_failed", scope: "trade" },
  { event: "trade.unwound", scope: "trade" },
] as const;

export function eventLogOptionsForScopes(
  scopes: readonly string[],
  selected = "",
): string[] {
  const allowed = new Set(scopes);
  const names: string[] = [];
  for (const option of EVENT_LOG_OPTIONS) {
    if (allowed.has(option.scope)) {
      names.push(option.event);
    }
  }
  const extra = selected.trim();
  if (extra && !names.includes(extra)) {
    names.push(extra);
  }
  return names.sort((a, b) => a.localeCompare(b));
}
