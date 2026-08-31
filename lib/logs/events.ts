export const EVENT_LOG_OPTIONS = [
  { event: "account.created", scope: "system" },
  { event: "copy.listing_saved", scope: "system" },
  { event: "copy.invite_revoked", scope: "system" },
  { event: "copy.invite_sent", scope: "system" },
  { event: "copy.desk_created", scope: "system" },
  { event: "copy.favorite_toggled", scope: "system" },
  { event: "copy.profile_saved", scope: "system" },
  { event: "account.deleted", scope: "system" },
  { event: "account.renamed", scope: "system" },
  { event: "automations.save_failed", scope: "strategy" },
  { event: "automations.saved", scope: "strategy" },
  { event: "engine.close_failed", scope: "trade" },
  { event: "engine.open_failed", scope: "trade" },
  { event: "engine.tick", scope: "system" },
  { event: "engine.tick_admin", scope: "system" },
  { event: "exchange.remove_failed", scope: "system" },
  { event: "exchange.removed", scope: "system" },
  { event: "exchange.save_failed", scope: "system" },
  { event: "exchange.saved", scope: "system" },
  { event: "exchange.verify_failed", scope: "system" },
  { event: "member.created", scope: "system" },
  { event: "member.password_changed", scope: "system" },
  { event: "member.profile_updated", scope: "system" },
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
  { event: "dca.armed", scope: "trade" },
  { event: "dca.closed", scope: "trade" },
  { event: "dca.decision", scope: "trade" },
  { event: "dca.disarmed", scope: "trade" },
  { event: "dca.exit_rested", scope: "trade" },
  { event: "dca.saved", scope: "strategy" },
  { event: "dca.deleted", scope: "strategy" },
  { event: "template.applied", scope: "strategy" },
  { event: "template.deleted", scope: "strategy" },
  { event: "template.imported", scope: "strategy" },
  { event: "template.saved", scope: "strategy" },
  { event: "template.shared", scope: "strategy" },
  { event: "engine.fired", scope: "trade" },
  { event: "trade.futures", scope: "trade" },
  { event: "trade.futures_failed", scope: "trade" },
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
