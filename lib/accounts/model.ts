import {
  getVenue,
  parseStoredVenueEnvironment,
  parseStoredVenueId,
  parseVenueEnvironment,
  parseVenueId,
  venueAllowsDeskType,
} from "@/lib/exchanges/venues";

export type TradingAccountMode = "paper" | "live";
export type DeskType =
  | "cash_and_carry"
  | "perps"
  | "perps_bots"
  | "signal_follower"
  | "dca";

export const DEFAULT_ACCOUNT_NAME = "Demo Account";
export const DEFAULT_DESK_TYPE: DeskType = "cash_and_carry";

export type TradingAccount = {
  id: string;
  userId: string;
  name: string;
  mode: TradingAccountMode;
  deskType: DeskType;
  venue: string;
  venueEnvironment: string | null;
  copyOfAccountId: string | null;
  createdAtMs: number;
};

export type DeskCapabilityInput =
  | DeskType
  | { deskType: DeskType; copyOfAccountId?: string | null };

export const COPY_DESK_BLOCK =
  "This is a copy desk. The parent owns orders. This desk only protects.";

export type DeskCreateChoice = {
  deskType: DeskType;
  venue: string;
  mode: TradingAccountMode;
  venueEnvironment: string | null;
};

export function parseAccountMode(value: unknown): TradingAccountMode {
  return value === "live" ? "live" : "paper";
}

export function parseDeskType(value: unknown): DeskType {
  if (
    value === "perps" ||
    value === "perps_bots" ||
    value === "signal_follower" ||
    value === "dca"
  ) {
    return value;
  }
  return "cash_and_carry";
}

export function parseDeskTypeChoice(
  value: unknown,
): { ok: true; deskType: DeskType } | { ok: false; error: string } {
  const raw = String(value ?? "").trim();
  if (
    raw === "cash_and_carry" ||
    raw === "perps" ||
    raw === "perps_bots" ||
    raw === "signal_follower" ||
    raw === "dca"
  ) {
    return { ok: true, deskType: raw };
  }
  return { ok: false, error: "Choose a desk type." };
}

export const AUTOMATED_DESK_TYPES: DeskType[] = [
  "perps_bots",
  "dca",
  "cash_and_carry",
  "signal_follower",
];

export const MANUAL_DESK_TYPES: DeskType[] = ["perps"];

export function formatDeskNavLabel(deskType: DeskType): string {
  return deskType === "perps_bots" ? "Perps" : formatDeskType(deskType);
}

export function formatDeskType(deskType: DeskType): string {
  if (deskType === "perps") {
    return "Perps";
  }
  if (deskType === "perps_bots") {
    return "Perps bots";
  }
  if (deskType === "signal_follower") {
    return "TradingView Strategy";
  }
  if (deskType === "dca") {
    return "DCA";
  }
  return "Cash and Carry";
}

export function formatDeskTypeChoice(deskType: DeskType): string {
  if (deskType === "perps") {
    return "Perps (buy / sell / close from the ticket)";
  }
  if (deskType === "perps_bots") {
    return "Perps bots (price-cross automations own the orders)";
  }
  if (deskType === "signal_follower") {
    return "TradingView Strategy (alerts send buy / sell / close)";
  }
  if (deskType === "dca") {
    return "DCA (app owns orders and exits)";
  }
  return "Cash and Carry (spot + dated future)";
}

export const DESK_QUERY = "desk";
export const DESK_HEADER = "x-tbp-desk";
export const DESK_PATHNAME_HEADER = "x-tbp-pathname";
export const DESK_SEARCH_HEADER = "x-tbp-search";

export function parseDeskQuery(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      raw,
    )
  ) {
    return null;
  }
  return raw.toLowerCase();
}

export function withQuery(
  path: string,
  extra: Record<string, string>,
): string {
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const queryIndex = withoutHash.indexOf("?");
  const pathname =
    queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const params = new URLSearchParams(
    queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "",
  );
  for (const [key, value] of Object.entries(extra)) {
    params.set(key, value);
  }
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

export function pathWithDesk(path: string, accountId: string): string {
  return withQuery(path, { [DESK_QUERY]: accountId });
}

export function hrefPathname(href: string): string {
  const withoutHash = href.split("#")[0] ?? href;
  return withoutHash.split("?")[0] ?? withoutHash;
}

export function isDeskScopedPath(pathname: string): boolean {
  return (
    pathname === "/strategies/futures" ||
    pathname.startsWith("/strategies/futures/") ||
    pathname === "/strategies/cash-and-carry" ||
    pathname.startsWith("/strategies/cash-and-carry/") ||
    pathname === "/account/book" ||
    pathname.startsWith("/account/book/")
  );
}

export function deskHref(path: string, accountId: string | null | undefined): string {
  return accountId ? pathWithDesk(path, accountId) : path;
}

export function deskIdFromHref(href: string): string | null {
  const withoutHash = href.split("#")[0] ?? href;
  const queryIndex = withoutHash.indexOf("?");
  if (queryIndex < 0) {
    return null;
  }
  return parseDeskQuery(
    new URLSearchParams(withoutHash.slice(queryIndex + 1)).get(DESK_QUERY),
  );
}

export function withDeskFrom(path: string, sourceHref: string): string {
  const desk = deskIdFromHref(sourceHref);
  return desk ? pathWithDesk(path, desk) : path;
}

export function deskPath(
  path: string,
  accountId: string | null | undefined,
  extra: Record<string, string> = {},
): string {
  return withQuery(deskHref(path, accountId), extra);
}

export function navLinksWithDesk<T extends { href: string }>(
  links: readonly T[],
  accountId: string,
): T[] {
  return links.map((link) => ({
    ...link,
    href: pathWithDesk(link.href, accountId),
  }));
}

export function createDeskPath(deskType: DeskType): string {
  return `/account/desks/new?type=${deskType}`;
}

export function deskHomePath(deskType: DeskType, accountId?: string): string {
  const base =
    deskType === "cash_and_carry"
      ? "/strategies/cash-and-carry/positions"
      : "/strategies/futures/positions";
  return accountId ? pathWithDesk(base, accountId) : base;
}

export function deskUsesCashAndCarry(deskType: DeskType): boolean {
  return deskType === "cash_and_carry";
}

export function deskUsesPerpsUi(deskType: DeskType): boolean {
  return deskType !== "cash_and_carry";
}

function capabilityDeskType(desk: DeskCapabilityInput): DeskType {
  return typeof desk === "string" ? desk : desk.deskType;
}

export function deskIsCopy(
  desk: { copyOfAccountId?: string | null } | DeskCapabilityInput | null | undefined,
): boolean {
  if (desk == null || typeof desk === "string") {
    return false;
  }
  return Boolean(desk.copyOfAccountId);
}

export function deskAllowsManualPerpTicket(desk: DeskCapabilityInput): boolean {
  if (deskIsCopy(desk)) {
    return false;
  }
  return capabilityDeskType(desk) === "perps";
}

export function deskAllowsPerpsRecipes(desk: DeskCapabilityInput): boolean {
  if (deskIsCopy(desk)) {
    return false;
  }
  return capabilityDeskType(desk) === "perps_bots";
}

export function deskAllowsDcaPlaybooks(desk: DeskCapabilityInput): boolean {
  if (deskIsCopy(desk)) {
    return false;
  }
  return capabilityDeskType(desk) === "dca";
}

/** Copy of DCA uses the DCA blotter, not playbook edit. */
export function deskShowsDcaBlotter(desk: DeskCapabilityInput): boolean {
  return capabilityDeskType(desk) === "dca";
}

export function deskAllowsSignalWebhooks(desk: DeskCapabilityInput): boolean {
  if (deskIsCopy(desk)) {
    return false;
  }
  const deskType = capabilityDeskType(desk);
  return deskType === "dca" || deskType === "perps_bots";
}

export function deskAllowsOrderWebhooks(desk: DeskCapabilityInput): boolean {
  if (deskIsCopy(desk)) {
    return false;
  }
  return capabilityDeskType(desk) === "signal_follower";
}

export function deskAllowsTemplateApply(desk: DeskCapabilityInput): boolean {
  if (deskIsCopy(desk)) {
    return false;
  }
  const deskType = capabilityDeskType(desk);
  return (
    deskType === "dca" ||
    deskType === "perps_bots" ||
    deskType === "cash_and_carry"
  );
}

export function deskAllowsBacktestFrom(desk: DeskCapabilityInput): boolean {
  return deskAllowsDcaPlaybooks(desk) || deskAllowsPerpsRecipes(desk);
}

export function formatDeskCopyBadge(
  desk: { copyOfAccountId?: string | null } | null | undefined,
): string | null {
  return deskIsCopy(desk) ? "Copy" : null;
}

export function deskManualBuySellBlockReason(
  desk: DeskCapabilityInput,
): string | null {
  if (deskAllowsManualPerpTicket(desk)) {
    return null;
  }
  if (deskIsCopy(desk)) {
    return COPY_DESK_BLOCK;
  }
  const deskType = capabilityDeskType(desk);
  if (deskType === "perps_bots") {
    return "This is a Perps bots desk. Automations own orders. Buy and Sell are not on this ticket.";
  }
  if (deskType === "dca") {
    return "This is a DCA desk. The bot owns orders. Buy and Sell are not on this ticket.";
  }
  if (deskType === "signal_follower") {
    return "This is a TradingView Strategy desk. Buy and Sell come from a webhook.";
  }
  return "This desk does not take Buy or Sell from the ticket.";
}

export function parseAccountName(
  value: unknown,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(value ?? "").trim();
  if (name.length < 1 || name.length > 40) {
    return { ok: false, error: "Name must be 1 to 40 characters." };
  }
  return { ok: true, name };
}

export const DESK_NAME_TAKEN = "You already have a desk with that name.";

export function deskNameTaken(name: string, existing: string[]): boolean {
  const needle = name.trim().toLowerCase();
  if (!needle) {
    return false;
  }
  return existing.some((item) => item.trim().toLowerCase() === needle);
}

export function validateNewDeskName(
  value: unknown,
  existing: string[],
): { ok: true; name: string } | { ok: false; error: string } {
  const named = parseAccountName(value);
  if (!named.ok) {
    return named;
  }
  if (deskNameTaken(named.name, existing)) {
    return { ok: false, error: DESK_NAME_TAKEN };
  }
  return named;
}

export function otherDeskNames(
  desks: { id: string; name: string }[],
  currentId: string,
): string[] {
  return desks.filter((desk) => desk.id !== currentId).map((desk) => desk.name);
}

export function parseDeskNameChange(
  value: unknown,
  otherNames: string[],
  currentName: string,
):
  | { ok: true; name: string; changed: boolean }
  | { ok: false; error: string } {
  const named = validateNewDeskName(value, otherNames);
  if (!named.ok) {
    return named;
  }
  return {
    ok: true,
    name: named.name,
    changed: named.name !== currentName,
  };
}

export function parseTradingAccountRow(
  row: Record<string, unknown>,
): TradingAccount {
  const created = new Date(String(row.created_at ?? "")).getTime();
  const venue = parseStoredVenueId(row.venue);
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name).trim(),
    mode: parseAccountMode(row.mode),
    deskType: parseDeskType(row.desk_type),
    venue,
    venueEnvironment: parseStoredVenueEnvironment(
      venue,
      row.venue_environment,
    ),
    copyOfAccountId: parseDeskQuery(row.copy_of_account_id),
    createdAtMs: Number.isFinite(created) ? created : 0,
  };
}

export function parseDeskCreateChoice(input: {
  deskType: unknown;
  venue: unknown;
  mode: unknown;
  track: unknown;
}): { ok: true; value: DeskCreateChoice } | { ok: false; error: string } {
  const typed = parseDeskTypeChoice(input.deskType);
  if (!typed.ok) {
    return typed;
  }
  const rawVenue = String(input.venue ?? "").trim();
  const venue = parseVenueId(rawVenue || "bybit");
  if (!venue.ok) {
    return venue;
  }
  if (!venueAllowsDeskType(venue.venue, typed.deskType)) {
    return {
      ok: false,
      error: `${venue.venue.label} cannot run ${formatDeskType(typed.deskType)}.`,
    };
  }
  const mode = parseAccountMode(input.mode);
  if (venue.venue.id !== "hyperliquid") {
    return {
      ok: true,
      value: {
        deskType: typed.deskType,
        venue: venue.venue.id,
        mode,
        venueEnvironment: null,
      },
    };
  }
  if (mode === "paper") {
    return {
      ok: true,
      value: {
        deskType: typed.deskType,
        venue: venue.venue.id,
        mode,
        venueEnvironment: null,
      },
    };
  }
  const environment = parseVenueEnvironment(
    venue.venue,
    String(input.track ?? "").trim() || "testnet",
  );
  if (!environment.ok) {
    return environment;
  }
  return {
    ok: true,
    value: {
      deskType: typed.deskType,
      venue: venue.venue.id,
      mode,
      venueEnvironment: environment.environment.id,
    },
  };
}

export function pickDefaultAccount(
  accounts: TradingAccount[],
): TradingAccount | null {
  return accounts.find((account) => account.mode === "paper") ?? accounts[0] ?? null;
}

export function pickSwitchAfterDelete(
  remaining: TradingAccount[],
  requestedId: unknown,
): TradingAccount | null {
  const id = String(requestedId ?? "").trim();
  return remaining.find((account) => account.id === id) ?? pickDefaultAccount(remaining);
}

export function formatDeskExchangeCaption(
  account: {
    mode: TradingAccountMode;
    venue: string;
    venueEnvironment: string | null;
  },
  bound: boolean,
): string | null {
  if (account.mode === "live" && !bound) {
    return null;
  }
  return formatDeskVenueCaption(account);
}

export function formatDeskVenueCaption(input: {
  venue: string;
  venueEnvironment: string | null;
}): string {
  const venue = getVenue(input.venue);
  const name = venue?.label ?? input.venue;
  if (!input.venueEnvironment) {
    return name;
  }
  const environment = venue
    ? parseVenueEnvironment(venue, input.venueEnvironment)
    : null;
  const envLabel = environment?.ok
    ? environment.environment.label
    : input.venueEnvironment;
  if (
    environment?.ok &&
    input.venue === "hyperliquid" &&
    environment.environment.id === "testnet"
  ) {
    return envLabel;
  }
  return `${name} · ${envLabel}`;
}

export function formatAccountMode(mode: TradingAccountMode): string {
  return mode === "live" ? "Connected Exchange" : "Paper Trading";
}

export function formatAccountModeChoice(mode: TradingAccountMode): string {
  return mode === "live"
    ? "Connected Exchange (uses a connected exchange)"
    : "Paper Trading (uses live market data - no real trades)";
}

export type AccountDeleteBlock = "last" | "open" | "automations";
export type ConnectionRemoveBlock = "in_use";
export type StrategyDetachBlock = "open" | "automations";

export function accountDeleteBlockers(input: {
  accountCount: number;
  openCount: number;
  automationsRunning: boolean;
  mode: TradingAccountMode;
}): AccountDeleteBlock[] {
  const blocks: AccountDeleteBlock[] = [];
  if (input.accountCount <= 1) {
    blocks.push("last");
  }
  if (input.openCount > 0) {
    blocks.push("open");
  }
  if (input.automationsRunning) {
    blocks.push("automations");
  }
  return blocks;
}

export function formatDeleteBlockers(
  blocks: readonly AccountDeleteBlock[],
): string {
  const parts: string[] = [];
  if (blocks.includes("last")) {
    parts.push("Keep at least one desk");
  }
  const open = blocks.includes("open");
  const automations = blocks.includes("automations");
  if (open && automations) {
    parts.push("Disable bots and exit all positions first");
  } else if (open) {
    parts.push("Exit all positions first");
  } else if (automations) {
    parts.push("Disable bots first");
  }
  return parts.join(" · ");
}

export type OverviewAttention = {
  label: string;
  href: string;
};

export function overviewAttentionItems(input: {
  accounts: readonly {
    id: string;
    name: string;
    mode: TradingAccountMode;
    venue?: string;
  }[];
  binds: readonly { connectionId: string; accountId: string }[];
}): OverviewAttention[] {
  const boundIds = new Set(input.binds.map((bind) => bind.accountId));
  const unboundLive = input.accounts.filter(
    (account) => account.mode === "live" && !boundIds.has(account.id),
  );
  const desksByKey = new Map<string, Set<string>>();
  for (const bind of input.binds) {
    const desks = desksByKey.get(bind.connectionId) ?? new Set<string>();
    desks.add(bind.accountId);
    desksByKey.set(bind.connectionId, desks);
  }
  const sharedKeys = [...desksByKey.values()].filter(
    (desks) => desks.size > 1,
  ).length;
  const items: OverviewAttention[] = [];
  if (unboundLive.length === 1) {
    const desk = unboundLive[0];
    const venue = getVenue(desk.venue ?? "")?.label ?? desk.venue;
    items.push({
      label: venue
        ? `${desk.name} is a live ${venue} desk with no key bound.`
        : `${desk.name} is live with no key bound.`,
      href: "/account/exchanges",
    });
  } else if (unboundLive.length > 1) {
    items.push({
      label: `${unboundLive.length} live desks have no key bound.`,
      href: "/account/sub-accounts",
    });
  }
  if (sharedKeys === 1) {
    items.push({
      label: "One exchange key is bound to more than one desk.",
      href: "/account/exchanges",
    });
  } else if (sharedKeys > 1) {
    items.push({
      label: `${sharedKeys} exchange keys are bound to more than one desk.`,
      href: "/account/exchanges",
    });
  }
  return items;
}

export function formatAccountUsageStatus(input: {
  openCount: number;
  workingCount?: number;
  automationsRunning: boolean;
  reduceOnly?: boolean;
}): string {
  const parts: string[] = [];
  if (input.openCount > 0) {
    parts.push(
      input.openCount === 1
        ? "1 Open position"
        : `${input.openCount} Open positions`,
    );
  }
  const working = input.workingCount ?? 0;
  if (working > 0) {
    parts.push(working === 1 ? "1 Open order" : `${working} Open orders`);
  }
  if (input.automationsRunning) {
    parts.push("Bots on");
  }
  if (input.reduceOnly) {
    parts.push("Reduce only");
  }
  return parts.join(" - ");
}

export function connectionRemoveBlockers(input: {
  inUse: boolean;
}): ConnectionRemoveBlock[] {
  return input.inUse ? ["in_use"] : [];
}

export function formatConnectionRemoveBlockers(
  blocks: ConnectionRemoveBlock[],
): string {
  if (blocks.includes("in_use")) {
    return "Detach this key from every desk in Desk Settings first";
  }
  return "";
}

export function strategyDetachBlockers(input: {
  openCount: number;
  automationsRunning: boolean;
}): StrategyDetachBlock[] {
  const blocks: StrategyDetachBlock[] = [];
  if (input.openCount > 0) {
    blocks.push("open");
  }
  if (input.automationsRunning) {
    blocks.push("automations");
  }
  return blocks;
}

export function formatStrategyDetachBlockers(
  blocks: StrategyDetachBlock[],
): string {
  return formatDeleteBlockers(blocks);
}
