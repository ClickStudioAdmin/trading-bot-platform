import {
  AUTOMATED_DESK_TYPES,
  deskNameTaken,
  formatDeskType,
  MANUAL_DESK_TYPES,
  parseDeskTypeChoice,
  pathWithDesk,
  validateNewDeskName,
  type DeskType,
} from "@/lib/accounts/model";
import {
  connectionVenuesForDeskType,
  getVenue,
  parseVenueEnvironment,
  venueAllowsDeskType,
  venuesForDeskType,
} from "@/lib/exchanges/venues";
import {
  ACCOUNT_DESKS_HREF,
  ACCOUNT_EXCHANGES_HREF,
} from "@/lib/site-links";

export const SETUP_PATH = "/account/setup";

/** Same order as the account sidebar: automated desks, then manual Perps. */
export const ONBOARDING_DESK_TYPES: DeskType[] = [
  ...AUTOMATED_DESK_TYPES,
  ...MANUAL_DESK_TYPES,
];

export type OnboardingStatus = "pending" | "finishing" | "skipped" | "completed";
export type OnboardingTour =
  | "declined"
  | "in_progress"
  | "completed"
  | "skipped";
export type SetupTourChoice = "yes" | "not_now";
export type SetupStep = "desks" | "exchanges" | "bots" | "tour";
export const SETUP_MAIN_STEPS = ["desks", "bots", "tour"] as const;
export type SetupMainStep = (typeof SETUP_MAIN_STEPS)[number];
export type SetupScreen =
  | { main: "desks"; sub: "choice" | "desks" | "exchanges" }
  | { main: "bots"; sub: "choice" | "blocked" | "empty" }
  | { main: "bots"; sub: "desk"; deskKey: string }
  | { main: "tour"; sub: "tour" };
export type StarterVisibility = "platform" | "user" | "backtested";
export type StarterDeskType = "dca" | "perps" | "cash_and_carry";

export type StarterTemplate = {
  id: string;
  name: string;
  visibility: StarterVisibility;
};

export type StarterFolder = {
  id: string;
  name: string;
  deskType: StarterDeskType;
  visibility: StarterVisibility;
  starterPack: boolean;
  templates: StarterTemplate[];
};

export type SetupDesk = {
  key: string;
  deskType: DeskType;
  mode: "paper" | "live";
  name: string;
  nameEdited: boolean;
  venue: string;
  environmentId: string | null;
  connectionId: string | null;
  bindLater: boolean;
  templateIds: string[];
  accountId: string | null;
};

export type SetupSummary = {
  desks: { name: string; detail: string }[];
  bots: { name: string; detail: string }[];
  dismissed: boolean;
};

export type DeskSetupChoice = "all_paper" | "manual" | "none";
export type BotSetupChoice = "all" | "manual" | "none";

export type SetupDraft = {
  desks: SetupDesk[];
  deskChoice: DeskSetupChoice | null;
  botChoice: BotSetupChoice | null;
  tourChoice: SetupTourChoice | null;
  applied: string[];
  summary: SetupSummary | null;
  /** Desks and bots are already written. The tour step can show them. */
  readyForTour: boolean;
};

export type SetupConnection = {
  id: string;
  venue: string;
  environment: string;
  label: string | null;
  fingerprint: string;
  status: "active" | "invalid";
};

export type TourStep = {
  id: string;
  title: string;
  body: string;
  href: string;
  target: string;
};

export type TourDesk = {
  id: string;
  deskType: DeskType;
  copyOfAccountId?: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SECRET_KEYS = new Set([
  "apikey",
  "apisecret",
  "agentkey",
  "credentials",
  "ciphertext",
  "nonce",
  "secret",
]);

export function emptySetupDraft(): SetupDraft {
  return {
    desks: [],
    deskChoice: null,
    botChoice: null,
    tourChoice: null,
    applied: [],
    summary: null,
    readyForTour: false,
  };
}

export function setupDeskKey(deskType: DeskType, mode: "paper" | "live"): string {
  return `${deskType}:${mode}`;
}

export function deskSupportsStarterBots(deskType: DeskType): boolean {
  return (
    deskType === "dca" ||
    deskType === "perps_bots" ||
    deskType === "cash_and_carry"
  );
}

export function starterDeskTypeFor(deskType: DeskType): StarterDeskType | null {
  if (deskType === "dca" || deskType === "cash_and_carry") {
    return deskType;
  }
  if (deskType === "perps_bots") {
    return "perps";
  }
  return null;
}

export function defaultSetupName(deskType: DeskType, mode: "paper" | "live"): string {
  const suffix = mode === "paper" ? "Paper" : "Connected";
  return `${formatDeskType(deskType)} ${suffix}`.slice(0, 40).trim();
}

export function connectedSetupName(
  deskType: DeskType,
  venueId: string,
  environmentId: string | null,
): string {
  const venue = getVenue(venueId);
  const label = venue?.label ?? venueId;
  const parsed = venue
    ? parseVenueEnvironment(venue, environmentId ?? "")
    : null;
  const demo =
    parsed?.ok &&
    (parsed.environment.id === "demo" || parsed.environment.id === "testnet");
  return `${formatDeskType(deskType)} ${label}${demo ? " Demo" : ""}`
    .slice(0, 40)
    .trim();
}

export function allocateSetupName(base: string, taken: readonly string[]): string {
  const trimmed = base.slice(0, 40).trim();
  if (!deskNameTaken(trimmed, [...taken])) {
    return trimmed;
  }
  for (let n = 2; n < 30; n += 1) {
    const suffix = ` ${n}`;
    const next = `${trimmed.slice(0, 40 - suffix.length).trim()}${suffix}`;
    if (!deskNameTaken(next, [...taken])) {
      return next;
    }
  }
  return trimmed;
}

export function paperVenuesFor(deskType: DeskType) {
  return venuesForDeskType(deskType);
}

export function connectedVenuesFor(deskType: DeskType) {
  return connectionVenuesForDeskType(deskType);
}

export function defaultPaperVenue(deskType: DeskType): string {
  return paperVenuesFor(deskType)[0]?.id ?? "bybit";
}

export function defaultConnectedVenue(deskType: DeskType): string {
  return connectedVenuesFor(deskType)[0]?.id ?? "bybit";
}

export function defaultEnvironmentId(venueId: string): string {
  const venue = getVenue(venueId);
  if (!venue) {
    return "live";
  }
  if (venueId === "hyperliquid") {
    return (
      venue.environments.find((item) => item.id === "testnet")?.id ??
      venue.environments[0]?.id ??
      "testnet"
    );
  }
  return venue.environments[0]?.id ?? "live";
}

export function makeSetupDesk(input: {
  deskType: DeskType;
  mode: "paper" | "live";
  takenNames: readonly string[];
}): SetupDesk {
  const venue =
    input.mode === "paper"
      ? defaultPaperVenue(input.deskType)
      : defaultConnectedVenue(input.deskType);
  const environmentId =
    input.mode === "live" ? defaultEnvironmentId(venue) : null;
  const base =
    input.mode === "live"
      ? connectedSetupName(input.deskType, venue, environmentId)
      : defaultSetupName(input.deskType, "paper");
  return {
    key: setupDeskKey(input.deskType, input.mode),
    deskType: input.deskType,
    mode: input.mode,
    name: allocateSetupName(base, input.takenNames),
    nameEdited: false,
    venue,
    environmentId,
    connectionId: null,
    bindLater: input.mode === "live",
    templateIds: [],
    accountId: null,
  };
}

export function draftHasSecret(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => draftHasSecret(item));
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEYS.has(key.toLowerCase().replace(/[_-]/g, ""))) {
      return true;
    }
    if (draftHasSecret(child)) {
      return true;
    }
  }
  return false;
}

function asUuid(value: unknown): string | null {
  const raw = String(value ?? "").trim().toLowerCase();
  return UUID_RE.test(raw) ? raw : null;
}

function asStringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids: string[] = [];
  for (const item of value) {
    const id = asUuid(item);
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
    if (ids.length >= max) {
      break;
    }
  }
  return ids;
}

export function parseSetupDraft(
  raw: unknown,
): { ok: true; draft: SetupDraft } | { ok: false; error: string } {
  if (raw == null) {
    return { ok: true, draft: emptySetupDraft() };
  }
  if (typeof raw === "string") {
    try {
      return parseSetupDraft(JSON.parse(raw) as unknown);
    } catch {
      return { ok: false, error: "Setup could not be read." };
    }
  }
  if (draftHasSecret(raw)) {
    return { ok: false, error: "Setup cannot store exchange secrets." };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Setup could not be read." };
  }
  const body = raw as Record<string, unknown>;
  const rows = Array.isArray(body.desks) ? body.desks : [];
  if (rows.length > 10) {
    return { ok: false, error: "Choose at most one desk per type and mode." };
  }
  const desks: SetupDesk[] = [];
  for (const row of rows) {
    const parsed = parseSetupDesk(row);
    if (!parsed.ok) {
      return parsed;
    }
    if (desks.some((desk) => desk.key === parsed.desk.key)) {
      return { ok: false, error: "Each type and mode can be chosen once." };
    }
    desks.push(parsed.desk);
  }
  const tourRaw = body.tourChoice;
  const tourChoice =
    tourRaw === "yes" || tourRaw === "not_now" ? tourRaw : null;
  const applied = Array.isArray(body.applied)
    ? body.applied.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 200)
    : [];
  const summary = parseSummary(body.summary);
  return {
    ok: true,
    draft: {
      desks,
      deskChoice: parseDeskSetupChoice(body.deskChoice),
      botChoice: parseBotSetupChoice(body.botChoice),
      tourChoice,
      applied,
      summary,
      readyForTour: body.readyForTour === true,
    },
  };
}

function parseDeskSetupChoice(value: unknown): DeskSetupChoice | null {
  if (value === "all_paper" || value === "manual" || value === "none") {
    return value;
  }
  return null;
}

function parseBotSetupChoice(value: unknown): BotSetupChoice | null {
  if (value === "all" || value === "manual" || value === "none") {
    return value;
  }
  return null;
}

function parseSetupDesk(
  raw: unknown,
): { ok: true; desk: SetupDesk } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Choose a desk type." };
  }
  const row = raw as Record<string, unknown>;
  const typed = parseDeskTypeChoice(row.deskType);
  if (!typed.ok) {
    return typed;
  }
  const mode = row.mode === "live" ? "live" : row.mode === "paper" ? "paper" : null;
  if (!mode) {
    return { ok: false, error: "Choose Paper or Connected." };
  }
  const venueId = String(row.venue ?? "").trim();
  const venue = getVenue(venueId);
  if (!venue || !venueAllowsDeskType(venue, typed.deskType)) {
    return {
      ok: false,
      error: `${venue?.label ?? "That exchange"} cannot run ${formatDeskType(typed.deskType)}.`,
    };
  }
  let environmentId: string | null = null;
  if (mode === "live") {
    const environment = parseVenueEnvironment(venue, row.environmentId);
    if (!environment.ok) {
      return environment;
    }
    environmentId = environment.environment.id;
  }
  const named = validateNewDeskName(row.name, []);
  if (!named.ok) {
    return named;
  }
  const connectionId = row.connectionId == null || row.connectionId === ""
    ? null
    : asUuid(row.connectionId);
  if (row.connectionId && !connectionId) {
    return { ok: false, error: "Pick an exchange key saved on this login." };
  }
  const accountId = row.accountId == null || row.accountId === ""
    ? null
    : asUuid(row.accountId);
  if (row.accountId && !accountId) {
    return { ok: false, error: "Setup could not be read." };
  }
  return {
    ok: true,
    desk: {
      key: setupDeskKey(typed.deskType, mode),
      deskType: typed.deskType,
      mode,
      name: named.name,
      nameEdited: row.nameEdited === true,
      venue: venue.id,
      environmentId,
      connectionId,
      bindLater: mode === "paper" ? false : row.bindLater !== false && !connectionId,
      templateIds: asStringList(row.templateIds, 40),
      accountId,
    },
  };
}

function parseSummary(raw: unknown): SetupSummary | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const body = raw as Record<string, unknown>;
  const lines = (value: unknown) => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.slice(0, 40).flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }
      const row = item as Record<string, unknown>;
      const name = String(row.name ?? "").trim().slice(0, 80);
      const detail = String(row.detail ?? "").trim().slice(0, 180);
      return name ? [{ name, detail }] : [];
    });
  };
  return {
    desks: lines(body.desks),
    bots: lines(body.bots),
    dismissed: body.dismissed === true,
  };
}

export function validateSetupNames(
  desks: readonly SetupDesk[],
  existingNames: readonly string[],
): { ok: true } | { ok: false; error: string } {
  const taken = [...existingNames];
  for (const desk of desks) {
    const named = validateNewDeskName(desk.name, taken);
    if (!named.ok) {
      return named;
    }
    taken.push(named.name);
  }
  return { ok: true };
}

export function connectionReuseError(input: {
  desks: readonly { connectionId: string | null; name: string }[];
  boundIds?: readonly string[];
}): string | null {
  const seen = new Set<string>();
  for (const id of input.boundIds ?? []) {
    if (id) {
      seen.add(id);
    }
  }
  for (const desk of input.desks) {
    if (!desk.connectionId) {
      continue;
    }
    if (seen.has(desk.connectionId)) {
      return `That exchange key is already chosen for another desk. Use a different trade-only key.`;
    }
    seen.add(desk.connectionId);
  }
  return null;
}

export type SetupBlock = {
  deskType: DeskType;
  mode: "paper" | "live";
};

export function blockedSetupDesks(
  desks: readonly SetupDesk[],
  blocks: readonly SetupBlock[],
): SetupDesk[] {
  return desks.filter((desk) =>
    blocks.some(
      (block) => block.deskType === desk.deskType && block.mode === desk.mode,
    ),
  );
}

export function onboardingFolders(folders: readonly StarterFolder[]): StarterFolder[] {
  return folders
    .filter((folder) => folder.visibility === "platform" && folder.starterPack)
    .map((folder) => ({
      ...folder,
      templates: folder.templates.filter(
        (template) => template.visibility === "platform",
      ),
    }))
    .filter((folder) => folder.templates.length > 0);
}

export function foldersForDesk(
  folders: readonly StarterFolder[],
  deskType: DeskType,
): StarterFolder[] {
  const kind = starterDeskTypeFor(deskType);
  if (!kind) {
    return [];
  }
  return onboardingFolders(folders).filter((folder) => folder.deskType === kind);
}

export function starterTemplateAllowed(input: {
  folders: readonly StarterFolder[];
  deskType: DeskType;
  templateId: string;
}): boolean {
  return foldersForDesk(input.folders, input.deskType).some((folder) =>
    folder.templates.some((template) => template.id === input.templateId),
  );
}

export function showsExchangeStep(desks: readonly SetupDesk[]): boolean {
  return desks.some((desk) => desk.mode === "live");
}

export function showsBotStep(
  desks: readonly SetupDesk[],
  folders: readonly StarterFolder[],
): boolean {
  return desks.some(
    (desk) => foldersForDesk(folders, desk.deskType).length > 0,
  );
}

export function starterBotDesks(
  desks: readonly SetupDesk[],
  folders: readonly StarterFolder[],
): SetupDesk[] {
  const rows: SetupDesk[] = [];
  for (const deskType of ONBOARDING_DESK_TYPES) {
    for (const mode of ["paper", "live"] as const) {
      const desk = desks.find(
        (row) => row.deskType === deskType && row.mode === mode,
      );
      if (desk && foldersForDesk(folders, desk.deskType).length > 0) {
        rows.push(desk);
      }
    }
  }
  return rows;
}

export function paperDesksForEachType(input: {
  existing: readonly SetupDesk[];
  takenNames: readonly string[];
}): SetupDesk[] {
  const rows: SetupDesk[] = [];
  const taken = [...input.takenNames];
  for (const deskType of ONBOARDING_DESK_TYPES) {
    const previous = input.existing.find(
      (desk) => desk.deskType === deskType && desk.mode === "paper",
    );
    if (previous) {
      rows.push(previous);
      taken.push(previous.name);
      continue;
    }
    const desk = makeSetupDesk({
      deskType,
      mode: "paper",
      takenNames: taken,
    });
    rows.push(desk);
    taken.push(desk.name);
  }
  return rows;
}

export function applyDeskSetupChoice(input: {
  choice: DeskSetupChoice;
  desks: readonly SetupDesk[];
  takenNames: readonly string[];
}): SetupDesk[] {
  if (input.choice === "all_paper") {
    return paperDesksForEachType({
      existing: input.desks,
      takenNames: input.takenNames,
    });
  }
  if (input.choice === "none") {
    return [];
  }
  return [...input.desks];
}

export function applyBotSetupChoice(input: {
  choice: BotSetupChoice;
  desks: readonly SetupDesk[];
  folders: readonly StarterFolder[];
}): SetupDesk[] {
  if (input.choice === "none") {
    return input.desks.map((desk) => ({ ...desk, templateIds: [] }));
  }
  if (input.choice === "all") {
    return input.desks.map((desk) => ({
      ...desk,
      templateIds: foldersForDesk(input.folders, desk.deskType).flatMap(
        (folder) => folder.templates.map((template) => template.id),
      ),
    }));
  }
  return [...input.desks];
}

export function setupScreens(input: {
  desks: readonly SetupDesk[];
  folders: readonly StarterFolder[];
  deskChoice: DeskSetupChoice | null;
  botChoice: BotSetupChoice | null;
}): SetupScreen[] {
  const screens: SetupScreen[] = [{ main: "desks", sub: "choice" }];
  if (input.deskChoice === null) {
    return screens;
  }
  if (input.deskChoice === "manual") {
    screens.push({ main: "desks", sub: "desks" });
    if (showsExchangeStep(input.desks)) {
      screens.push({ main: "desks", sub: "exchanges" });
    }
  }
  const noDesks =
    input.deskChoice === "none" ||
    (input.deskChoice === "manual" && input.desks.length === 0);
  if (noDesks) {
    screens.push({ main: "bots", sub: "blocked" });
  } else {
    screens.push({ main: "bots", sub: "choice" });
    if (input.botChoice === "manual") {
      const bots = starterBotDesks(input.desks, input.folders);
      if (bots.length === 0) {
        screens.push({ main: "bots", sub: "empty" });
      } else {
        for (const desk of bots) {
          screens.push({ main: "bots", sub: "desk", deskKey: desk.key });
        }
      }
    }
  }
  screens.push({ main: "tour", sub: "tour" });
  return screens;
}

export function setupScreenId(screen: SetupScreen): string {
  if (screen.main === "bots" && screen.sub === "desk") {
    return `bots:${screen.deskKey}`;
  }
  return `${screen.main}:${screen.sub}`;
}

export function activeSetupScreen(
  screens: readonly SetupScreen[],
  screenId: string,
): SetupScreen {
  const found = screens.find((screen) => setupScreenId(screen) === screenId);
  if (found) {
    return found;
  }
  if (screenId.startsWith("bots:")) {
    const bots = screens.find((screen) => screen.main === "bots");
    if (bots) {
      return bots;
    }
  }
  return screens[0];
}

export function botsEmptyNote(desks: readonly SetupDesk[]): string {
  if (desks.length === 0) {
    return "No desks are selected, so there are no starter bots to load.";
  }
  if (!desks.some((desk) => deskSupportsStarterBots(desk.deskType))) {
    return "Perps is the ticket. TradingView Strategy takes alerts. Those desks do not load starter bots.";
  }
  return "No starter folders are marked for these desks.";
}

export function desksStillToCreate(desks: readonly SetupDesk[]): SetupDesk[] {
  return desks.filter((desk) => !desk.accountId);
}

export function applyKey(accountId: string, templateId: string): string {
  return `${accountId}:${templateId}`;
}

export function appliesStillToRun(
  desks: readonly SetupDesk[],
  applied: readonly string[],
): { accountId: string; templateId: string; key: string; deskName: string }[] {
  const done = new Set(applied);
  const rows: {
    accountId: string;
    templateId: string;
    key: string;
    deskName: string;
  }[] = [];
  for (const desk of desks) {
    if (!desk.accountId || !deskSupportsStarterBots(desk.deskType)) {
      continue;
    }
    for (const templateId of desk.templateIds) {
      const key = applyKey(desk.accountId, templateId);
      if (done.has(key)) {
        continue;
      }
      rows.push({
        accountId: desk.accountId,
        templateId,
        key,
        deskName: desk.name,
      });
    }
  }
  return rows;
}

export function statusAfterExternalDesk(
  status: OnboardingStatus | null,
): OnboardingStatus | null {
  if (status === null || status === "pending") {
    return "skipped";
  }
  return status;
}

export function requiresSetupGate(input: {
  platformMember: boolean;
  emailVerified: boolean;
  deskCount: number;
  status: OnboardingStatus | null;
}): boolean {
  if (!input.platformMember || !input.emailVerified) {
    return false;
  }
  if (input.status === "skipped" || input.status === "completed") {
    return false;
  }
  if (input.status === "pending" || input.status === "finishing") {
    return true;
  }
  return input.deskCount === 0;
}

export function shouldOfferTour(input: {
  platformMember: boolean;
  tour: OnboardingTour | null;
}): boolean {
  return (
    input.platformMember &&
    input.tour !== "completed" &&
    input.tour !== "skipped"
  );
}

export function shouldShowSummary(summary: SetupSummary | null): boolean {
  return Boolean(summary && !summary.dismissed && (summary.desks.length > 0 || summary.bots.length > 0));
}

export function validateSetupForFinish(input: {
  draft: SetupDraft;
  existingNames: readonly string[];
  blocks: readonly SetupBlock[];
  folders: readonly StarterFolder[];
  boundConnectionIds: readonly string[];
}): { ok: true; draft: SetupDraft } | { ok: false; error: string } {
  const names = validateSetupNames(input.draft.desks, input.existingNames);
  if (!names.ok) {
    return names;
  }
  const blocked = blockedSetupDesks(input.draft.desks, input.blocks);
  if (blocked.length > 0) {
    return {
      ok: false,
      error: `${formatDeskType(blocked[0].deskType)} ${blocked[0].mode === "paper" ? "Paper" : "Connected"} is not available on this plan.`,
    };
  }
  const reuse = connectionReuseError({
    desks: input.draft.desks,
    boundIds: input.boundConnectionIds,
  });
  if (reuse) {
    return { ok: false, error: reuse };
  }
  for (const desk of input.draft.desks) {
    if (desk.mode === "live" && !desk.bindLater && !desk.connectionId) {
      return {
        ok: false,
        error: `Choose a key for ${desk.name}, or bind it later.`,
      };
    }
    if (desk.mode === "paper" && desk.connectionId) {
      return { ok: false, error: "Paper desks do not bind a key." };
    }
    for (const templateId of desk.templateIds) {
      if (
        !starterTemplateAllowed({
          folders: input.folders,
          deskType: desk.deskType,
          templateId,
        })
      ) {
        return { ok: false, error: "That starter bot is not available." };
      }
    }
  }
  return { ok: true, draft: input.draft };
}

export function tourTargetForPath(href: string): string | null {
  const path = href.split("?")[0] ?? href;
  if (path.endsWith("/automations")) {
    return "bots";
  }
  if (path.endsWith("/webhooks")) {
    return "webhooks";
  }
  if (path.endsWith("/positions")) {
    return "positions";
  }
  if (path.endsWith("/settings")) {
    return "desk-settings";
  }
  return null;
}

function isCopy(desk: TourDesk): boolean {
  return Boolean(desk.copyOfAccountId);
}

export function buildTourSteps(desks: readonly TourDesk[]): TourStep[] {
  const owned = desks.filter((desk) => !isCopy(desk));
  const any = owned[0] ?? null;
  const bot =
    owned.find((desk) => deskSupportsStarterBots(desk.deskType)) ?? null;
  const signal =
    owned.find((desk) => desk.deskType === "signal_follower") ?? null;
  const steps: TourStep[] = [
    {
      id: "overview",
      title: "Overview",
      body: "This is the account home after sign-in.",
      href: "/account",
      target: "overview",
    },
    {
      id: "manage-desks",
      title: "Manage desks",
      body: "Desks are created here. Type and mode stay as they were set.",
      href: ACCOUNT_DESKS_HREF,
      target: "manage-desks",
    },
    {
      id: "exchanges",
      title: "Exchanges",
      body: "Keys are trade-only. One key binds one desk. Demo and Live are the key’s environment.",
      href: ACCOUNT_EXCHANGES_HREF,
      target: "exchanges",
    },
  ];
  if (any) {
    steps.push({
      id: "desk-list",
      title: "Your desks",
      body: "Open a desk from this list. Paper, Demo, and Live are marked here.",
      href: "/account",
      target: "desk-list",
    });
  }
  if (bot) {
    const home =
      bot.deskType === "cash_and_carry"
        ? "/strategies/cash-and-carry/automations"
        : "/strategies/futures/automations";
    steps.push({
      id: "bots",
      title: "Bots",
      body: "Bots loaded in setup are idle or disabled. Arm or Enable is a separate action. The app places orders only after that.",
      href: pathWithDesk(home, bot.id),
      target: "bots",
    });
  } else if (signal) {
    steps.push({
      id: "webhooks",
      title: "Webhooks",
      body: "Alerts arrive here. Setup does not turn them on.",
      href: pathWithDesk("/strategies/futures/webhooks", signal.id),
      target: "webhooks",
    });
  }
  if (any) {
    const positions =
      any.deskType === "cash_and_carry"
        ? "/strategies/cash-and-carry/positions"
        : "/strategies/futures/positions";
    const settings =
      any.deskType === "cash_and_carry"
        ? "/strategies/cash-and-carry/settings"
        : "/strategies/futures/settings";
    steps.push(
      {
        id: "positions",
        title: "Positions",
        body: "Open positions for this desk.",
        href: pathWithDesk(positions, any.id),
        target: "positions",
      },
      {
        id: "desk-settings",
        title: "Desk settings",
        body: "Bind a key if this desk is still unbound, and set desk limits.",
        href: pathWithDesk(settings, any.id),
        target: "desk-settings",
      },
    );
  }
  steps.push({
    id: "templates",
    title: "Bot templates",
    body: "This is your library. Starter bots in setup came only from platform folders an admin marked Include in Starter Pack.",
    href: "/account/templates",
    target: "templates",
  });
  return steps;
}

export function setupStepLabel(step: SetupMainStep): string {
  if (step === "desks") {
    return "Desks";
  }
  if (step === "bots") {
    return "Bots";
  }
  return "Tour";
}
