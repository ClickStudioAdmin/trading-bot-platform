import { deskHref, deskPath, withQuery } from "@/lib/accounts/model";

export const AUTOMATIONS_EDIT_QUERY = "edit";
export const AUTOMATIONS_CLONE_QUERY = "clone";
export const AUTOMATIONS_NEW = "new";
export const BOT_HASH_PREFIX = "bot-";
export const AUTOMATIONS_FROM_QUERY = "from";
export const AUTOMATIONS_FROM_BOTS = "bots";
export const AUTOMATIONS_FOCUS_QUERY = "focus";

export const CASH_AND_CARRY_AUTOMATIONS_PATH =
  "/strategies/cash-and-carry/automations";
export const CASH_AND_CARRY_POSITIONS_PATH =
  "/strategies/cash-and-carry/positions";
export const CASH_AND_CARRY_PERFORMANCE_PATH =
  "/strategies/cash-and-carry/performance";

export function automationsBotBlotterHref(
  path: string,
  accountId: string | null | undefined,
  botId: string,
): string {
  return deskPath(path, accountId, {
    bot: botId,
    [AUTOMATIONS_FROM_QUERY]: AUTOMATIONS_FROM_BOTS,
    [AUTOMATIONS_FOCUS_QUERY]: botId,
  });
}

function firstQuery(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value ?? "").trim();
}

export function focusedBotTitle(
  base: string,
  bots: readonly { id: string; name: string }[],
  currentBot: string,
  focus: string,
): string {
  if (!focus || currentBot !== focus) {
    return base;
  }
  const name = bots.find((bot) => bot.id === focus)?.name?.trim() || "Bot";
  return `${base} - ${name}`;
}

export function automationsBotReturn(
  params: Record<string, string | string[] | undefined> | null | undefined,
  bots: readonly { id: string; name: string }[],
  currentBot: string,
  listPath: string,
  accountId: string | null | undefined,
): {
  backHref: string | null;
  keep: Record<string, string>;
  titleFor: (base: string) => string;
} {
  const focus = firstQuery(params?.[AUTOMATIONS_FOCUS_QUERY]);
  const fromBots =
    firstQuery(params?.[AUTOMATIONS_FROM_QUERY]) === AUTOMATIONS_FROM_BOTS &&
    Boolean(focus);
  const keep = fromBots
    ? {
        [AUTOMATIONS_FROM_QUERY]: AUTOMATIONS_FROM_BOTS,
        [AUTOMATIONS_FOCUS_QUERY]: focus,
      }
    : {};
  return {
    backHref: fromBots ? deskHref(listPath, accountId) : null,
    keep,
    titleFor: (base) =>
      focusedBotTitle(base, bots, currentBot, fromBots ? focus : ""),
  };
}

export function automationsReturnHref(
  path: string,
  accountId: string | null | undefined,
  keep: Record<string, string>,
): string {
  return Object.keys(keep).length
    ? deskPath(path, accountId, keep)
    : deskHref(path, accountId);
}

export function parseAutomationsEdit(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  return value ? value : null;
}

export function parseAutomationsClone(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  return value ? value : null;
}

export function parseBotHashId(hash: string): string | null {
  const id = hash.replace(/^#/, "").trim();
  if (!id.startsWith(BOT_HASH_PREFIX)) {
    return null;
  }
  const botId = id.slice(BOT_HASH_PREFIX.length).trim();
  return botId || null;
}

export function automationsListHref(
  path: string,
  extra: Record<string, string> = {},
): string {
  return withQuery(path, extra);
}

export function automationsEditHref(
  listHref: string,
  edit: string,
  extra: Record<string, string> = {},
): string {
  return withQuery(listHref, { [AUTOMATIONS_EDIT_QUERY]: edit, ...extra });
}

export function automationsNewHref(
  listHref: string,
  clone?: string | null,
): string {
  return automationsEditHref(
    listHref,
    AUTOMATIONS_NEW,
    clone ? { [AUTOMATIONS_CLONE_QUERY]: clone } : {},
  );
}

export function automationsSavedHref(
  listHref: string,
  createdId?: string | null,
): string {
  const created = String(createdId ?? "").trim();
  return withQuery(listHref, {
    saved: "1",
    ...(created ? { created } : {}),
  });
}

export function automationsEditTitle(input: {
  edit: string | null;
  name?: string | null;
}): string | null {
  if (!input.edit) {
    return null;
  }
  if (input.edit === AUTOMATIONS_NEW) {
    return "New bot";
  }
  const name = input.name?.trim();
  return name || "Edit bot";
}
