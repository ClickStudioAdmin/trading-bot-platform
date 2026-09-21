import { withQuery } from "@/lib/accounts/model";

export const AUTOMATIONS_EDIT_QUERY = "edit";
export const AUTOMATIONS_CLONE_QUERY = "clone";
export const AUTOMATIONS_NEW = "new";
export const BOT_HASH_PREFIX = "bot-";

export const CASH_AND_CARRY_AUTOMATIONS_PATH =
  "/strategies/cash-and-carry/automations";

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

export function automationsSavedHref(listHref: string): string {
  return withQuery(listHref, { saved: "1" });
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
