import type { ExchangePreview } from "@/lib/admin/emails";
import {
  AUTOMATED_DESK_TYPES,
  MANUAL_DESK_TYPES,
  type DeskType,
} from "@/lib/accounts/model";
import {
  connectionVenuesForDeskType,
  enabledVenues,
  getVenue,
  venueAllowsDeskType,
  venuesForDeskType,
  VENUES,
  type VenueDefinition,
  type VenueDeskType,
  type VenueEnvironment,
} from "@/lib/exchanges/venues";

/** Paper, exchange Demo / Testnet, or exchange Live. */
export const EXCHANGE_DESK_MODES = ["paper", "demo", "live"] as const;
export type ExchangeDeskMode = (typeof EXCHANGE_DESK_MODES)[number];

export type ExchangeAvailabilityStatus =
  | "in_development"
  | "testing"
  | "beta"
  | "live";

/** Edit matrix order: In Development, then Testing, Beta, and Live. */
export const EXCHANGE_STATUS_CHOICES = [
  ["in_development", "In Development"],
  ["testing", "Testing"],
  ["beta", "Beta"],
  ["live", "Live"],
] as const satisfies readonly (readonly [ExchangeAvailabilityStatus, string])[];

export type ExchangeAvailabilityCell = {
  venueId: string;
  deskType: VenueDeskType;
  mode: ExchangeDeskMode;
  /** Members can pick this exchange when creating a desk. */
  live: boolean;
  /** Platform testers, developers, and admins can pick it. */
  testing: boolean;
  /** Members can pick it. The desk shows a beta notice. */
  beta: boolean;
  /** Developers and admins can pick it. */
  inDevelopment: boolean;
};

export type ExchangeAvailabilityFlags = {
  live: boolean;
  testing: boolean;
  beta: boolean;
  inDevelopment: boolean;
};

function flagsFor(status: ExchangeAvailabilityStatus): ExchangeAvailabilityFlags {
  return {
    live: status === "live",
    testing: status === "testing",
    beta: status === "beta",
    inDevelopment: status === "in_development",
  };
}

/** A row is one status. Anything mixed stays Live. */
export function exclusiveChoice(
  live: boolean,
  testing: boolean,
  beta = false,
  inDevelopment = false,
): ExchangeAvailabilityFlags {
  if (inDevelopment && !live && !testing && !beta) {
    return flagsFor("in_development");
  }
  if (beta && !live && !testing && !inDevelopment) {
    return flagsFor("beta");
  }
  if (testing && !live && !beta && !inDevelopment) {
    return flagsFor("testing");
  }
  return flagsFor("live");
}

export type ExchangeAccess = {
  /** public is Beta and Live. testing adds Testing. development adds In Development. */
  preview: ExchangePreview;
  cells: ExchangeAvailabilityCell[];
};

/** Sidebar: automated desks, then Manual. */
export const SIDEBAR_DESK_TYPES: readonly DeskType[] = [
  ...AUTOMATED_DESK_TYPES,
  ...MANUAL_DESK_TYPES,
];

export function deskTypesInSidebarOrder<T extends string>(
  types: readonly T[],
): T[] {
  return [...types].sort(
    (left, right) =>
      SIDEBAR_DESK_TYPES.indexOf(left as DeskType) -
      SIDEBAR_DESK_TYPES.indexOf(right as DeskType),
  );
}

/** Every sidebar desk type, including ones this exchange cannot run. */
export function exchangeListDeskTypes(
  venue: VenueDefinition,
): { deskType: DeskType; offered: boolean }[] {
  return SIDEBAR_DESK_TYPES.map((deskType) => ({
    deskType,
    offered: venueAllowsDeskType(venue, deskType),
  }));
}

const DESK_TYPE_LABEL: Record<VenueDeskType, string> = {
  cash_and_carry: "Cash and Carry",
  manual: "Manual",
  flex: "Flex",
  signal_follower: "TradingView Strategy",
  dca: "DCA",
};

const MODE_LABEL: Record<ExchangeDeskMode, string> = {
  paper: "Paper",
  demo: "Demo",
  live: "Live",
};

export function isExchangeDeskMode(value: string): value is ExchangeDeskMode {
  return value === "paper" || value === "demo" || value === "live";
}

export function isVenueDeskType(value: string): value is VenueDeskType {
  return (
    value === "cash_and_carry" ||
    value === "manual" ||
    value === "flex" ||
    value === "signal_follower" ||
    value === "dca"
  );
}

export function availabilityKey(
  venueId: string,
  deskType: string,
  mode: string,
): string {
  return `${venueId}:${deskType}:${mode}`;
}

export function environmentDeskMode(
  environmentId: string | null | undefined,
): "demo" | "live" {
  const id = String(environmentId ?? "").trim().toLowerCase();
  if (id === "demo" || id === "testnet") {
    return "demo";
  }
  return "live";
}

/** Public on for every desk type the exchange can run. Testing starts off. */
export function defaultExchangeAvailability(): ExchangeAvailabilityCell[] {
  const cells: ExchangeAvailabilityCell[] = [];
  for (const venue of VENUES) {
    if (!venue.enabled) {
      continue;
    }
    for (const deskType of venue.deskTypes) {
      for (const mode of EXCHANGE_DESK_MODES) {
        cells.push({
          venueId: venue.id,
          deskType,
          mode,
          live: true,
          testing: false,
          beta: false,
          inDevelopment: false,
        });
      }
    }
  }
  return cells;
}

export function mergeExchangeAvailability(
  stored: readonly ExchangeAvailabilityCell[],
): ExchangeAvailabilityCell[] {
  const overlay = new Map(
    stored.map((cell) => [
      availabilityKey(cell.venueId, cell.deskType, cell.mode),
      cell,
    ]),
  );
  return defaultExchangeAvailability().map((cell) => {
    return (
      overlay.get(availabilityKey(cell.venueId, cell.deskType, cell.mode)) ??
      cell
    );
  });
}

export function parseAvailabilityRow(
  row: Record<string, unknown>,
): ExchangeAvailabilityCell | null {
  const venueId = String(row.venue ?? "").trim();
  const deskType = String(row.desk_type ?? "").trim();
  const mode = String(row.mode ?? "").trim();
  const venue = getVenue(venueId);
  if (!venue || !isVenueDeskType(deskType) || !isExchangeDeskMode(mode)) {
    return null;
  }
  if (!venueAllowsDeskType(venue, deskType)) {
    return null;
  }
  const choice = exclusiveChoice(
    row.live === true,
    row.testing === true,
    row.beta === true,
    row.in_development === true,
  );
  return {
    venueId,
    deskType,
    mode,
    live: choice.live,
    testing: choice.testing,
    beta: choice.beta,
    inDevelopment: choice.inDevelopment,
  };
}

export function availabilityCounts(
  venueId: string,
  cells: readonly ExchangeAvailabilityCell[],
  deskType?: string,
): { slots: number; live: number; testing: number } {
  const rows = cells.filter(
    (cell) =>
      cell.venueId === venueId &&
      (deskType == null || cell.deskType === deskType),
  );
  return {
    slots: rows.length,
    live: rows.filter((cell) => cell.live).length,
    testing: rows.filter((cell) => cell.testing).length,
  };
}

/** One status for a desk type and mode. A missing row stays Live. */
export function availabilitySetting(
  cells: readonly ExchangeAvailabilityCell[],
  venueId: string,
  deskType: string,
  mode: ExchangeDeskMode,
): ExchangeAvailabilityStatus {
  const cell = cellFor(cells, venueId, deskType, mode);
  const choice = exclusiveChoice(
    Boolean(cell?.live),
    Boolean(cell?.testing),
    Boolean(cell?.beta),
    Boolean(cell?.inDevelopment),
  );
  if (choice.inDevelopment) {
    return "in_development";
  }
  if (choice.beta) {
    return "beta";
  }
  return choice.testing ? "testing" : "live";
}

export function availabilityStatusLabel(
  status: ExchangeAvailabilityStatus,
): string {
  return (
    EXCHANGE_STATUS_CHOICES.find(([value]) => value === status)?.[1] ?? "Live"
  );
}

export function exchangeChoiceLabel(
  label: string,
  cells: readonly ExchangeAvailabilityCell[] | null | undefined,
  venueId: string,
  deskType: string,
  mode: ExchangeDeskMode,
): string {
  if (!cells) {
    return label;
  }
  const status = availabilitySetting(cells, venueId, deskType, mode);
  if (status === "live") {
    return label;
  }
  return `${label} · ${availabilityStatusLabel(status)}`;
}

export function connectedVenueChoiceLabel(
  venue: VenueDefinition,
  cells: readonly ExchangeAvailabilityCell[] | null | undefined,
  deskType: string,
): string {
  if (!cells || venue.environments.length === 0) {
    return venue.label;
  }
  const statuses = venue.environments.map((environment) =>
    availabilitySetting(
      cells,
      venue.id,
      deskType,
      environmentDeskMode(environment.id),
    ),
  );
  const first = statuses[0];
  if (first && first !== "live" && statuses.every((status) => status === first)) {
    return `${venue.label} · ${availabilityStatusLabel(first)}`;
  }
  return venue.label;
}

/** Notice for a desk whose exchange, type, and mode are Beta. */
export function deskBetaNotice(input: {
  cells: readonly ExchangeAvailabilityCell[];
  deskType: string;
  venueId: string;
  accountMode: "paper" | "live";
  environmentId: string | null;
}): string | null {
  if (input.accountMode === "live" && !input.environmentId) {
    return null;
  }
  const mode: ExchangeDeskMode =
    input.accountMode === "paper"
      ? "paper"
      : environmentDeskMode(input.environmentId);
  if (availabilitySetting(input.cells, input.venueId, input.deskType, mode) !== "beta") {
    return null;
  }
  const desk = isVenueDeskType(input.deskType)
    ? `${DESK_TYPE_LABEL[input.deskType]} Bots`
    : "Bots";
  return `${desk} are currently in Beta for ${MODE_LABEL[mode]} mode.`;
}

export function cellFor(
  cells: readonly ExchangeAvailabilityCell[],
  venueId: string,
  deskType: string,
  mode: ExchangeDeskMode,
): ExchangeAvailabilityCell | null {
  return (
    cells.find(
      (cell) =>
        cell.venueId === venueId &&
        cell.deskType === deskType &&
        cell.mode === mode,
    ) ?? null
  );
}

function flagAllows(
  flag: {
    live: boolean;
    testing: boolean;
    beta?: boolean;
    inDevelopment?: boolean;
  },
  preview: ExchangePreview,
): boolean {
  const choice = exclusiveChoice(
    flag.live,
    flag.testing,
    flag.beta,
    flag.inDevelopment,
  );
  if (choice.inDevelopment) {
    return preview === "development";
  }
  if (choice.testing) {
    return preview === "testing" || preview === "development";
  }
  return true;
}

function unsupportedMessage(venueId: string, deskType: string): string {
  const venue = getVenue(venueId);
  const name = venue?.label ?? "That exchange";
  const type = isVenueDeskType(deskType) ? DESK_TYPE_LABEL[deskType] : "that desk";
  return `${name} cannot run ${type}.`;
}

/**
 * Whether this viewer can create a desk on the exchange.
 * A connected desk with no environment yet is allowed when Demo or Live is on.
 */
export function exchangeCreateAllowed(input: {
  cells: readonly ExchangeAvailabilityCell[];
  preview: ExchangePreview;
  deskType: string;
  venueId: string;
  accountMode: "paper" | "live";
  environmentId: string | null;
}): { ok: true } | { ok: false; error: string } {
  const venue = getVenue(input.venueId);
  if (!venue || !venue.enabled) {
    return { ok: false, error: "That exchange is not available yet." };
  }
  if (!isVenueDeskType(input.deskType) || !venueAllowsDeskType(venue, input.deskType)) {
    return { ok: false, error: unsupportedMessage(input.venueId, input.deskType) };
  }
  const deskLabel = DESK_TYPE_LABEL[input.deskType];
  if (input.accountMode === "paper") {
    return modeAllowed(input, venue, "paper", `${venue.label} is not available for Paper on ${deskLabel}.`);
  }
  if (!venue.connectionsEnabled) {
    return {
      ok: false,
      error: `${venue.label} is not available for a connected ${deskLabel} desk.`,
    };
  }
  if (!input.environmentId) {
    const demo = modeAllowed(input, venue, "demo", "");
    const live = modeAllowed(input, venue, "live", "");
    if (demo.ok || live.ok) {
      return { ok: true };
    }
    return {
      ok: false,
      error: `${venue.label} is not available for a connected ${deskLabel} desk.`,
    };
  }
  const mode = environmentDeskMode(input.environmentId);
  return modeAllowed(
    input,
    venue,
    mode,
    `${venue.label} ${MODE_LABEL[mode]} is not available for ${deskLabel}.`,
  );
}

function modeAllowed(
  input: {
    cells: readonly ExchangeAvailabilityCell[];
    preview: ExchangePreview;
    deskType: string;
    venueId: string;
  },
  venue: VenueDefinition,
  mode: ExchangeDeskMode,
  error: string,
): { ok: true } | { ok: false; error: string } {
  if (mode !== "paper" && !venue.connectionsEnabled) {
    return { ok: false, error };
  }
  const cell = cellFor(input.cells, input.venueId, input.deskType, mode);
  const flag = cell ?? {
    live: true,
    testing: false,
    beta: false,
    inDevelopment: false,
  };
  if (!flagAllows(flag, input.preview)) {
    return { ok: false, error };
  }
  return { ok: true };
}

export function offeredVenues(
  access: ExchangeAccess | null,
  deskType: VenueDeskType,
  kind: "paper" | "connected",
): VenueDefinition[] {
  const rows =
    kind === "paper"
      ? venuesForDeskType(deskType)
      : connectionVenuesForDeskType(deskType);
  if (!access) {
    return rows;
  }
  return rows.filter(
    (venue) =>
      exchangeCreateAllowed({
        cells: access.cells,
        preview: access.preview,
        deskType,
        venueId: venue.id,
        accountMode: kind === "paper" ? "paper" : "live",
        environmentId: null,
      }).ok,
  );
}

export function offeredEnvironments(
  access: ExchangeAccess | null,
  venue: VenueDefinition,
  deskType: VenueDeskType,
): VenueEnvironment[] {
  if (!access) {
    return [...venue.environments];
  }
  return venue.environments.filter(
    (environment) =>
      exchangeCreateAllowed({
        cells: access.cells,
        preview: access.preview,
        deskType,
        venueId: venue.id,
        accountMode: "live",
        environmentId: environment.id,
      }).ok,
  );
}

/** Connected venues with only the environments this viewer can use on a new desk. */
export function offeredConnectionVenues(
  access: ExchangeAccess | null,
  deskType: VenueDeskType,
): VenueDefinition[] {
  return offeredVenues(access, deskType, "connected").flatMap((venue) => {
    const environments = offeredEnvironments(access, venue, deskType);
    if (environments.length === 0) {
      return [];
    }
    if (environments.length === venue.environments.length) {
      return [venue];
    }
    return [{ ...venue, environments }];
  });
}

/** Venues and environments this viewer can add a key for on any desk type. */
export function offeredAccountVenues(
  access: ExchangeAccess | null,
): VenueDefinition[] {
  const venues = enabledVenues();
  if (!access) {
    return venues;
  }
  return venues.flatMap((venue) => {
    const environments = venue.environments.filter((environment) =>
      SIDEBAR_DESK_TYPES.some(
        (deskType) =>
          venueAllowsDeskType(venue, deskType) &&
          exchangeCreateAllowed({
            cells: access.cells,
            preview: access.preview,
            deskType,
            venueId: venue.id,
            accountMode: "live",
            environmentId: environment.id,
          }).ok,
      ),
    );
    if (environments.length === 0) {
      return [];
    }
    if (environments.length === venue.environments.length) {
      return [venue];
    }
    return [{ ...venue, environments }];
  });
}

/** The desk's venue, limited to environments this viewer can use. */
export function deskBindVenues(
  access: ExchangeAccess | null,
  deskType: VenueDeskType,
  venueId: string,
  environmentId: string | null,
): VenueDefinition[] {
  const current = getVenue(venueId);
  if (!current || !current.connectionsEnabled) {
    return [];
  }
  const offered = offeredConnectionVenues(access, deskType).find(
    (venue) => venue.id === venueId,
  );
  const environments = [...(offered?.environments ?? [])];
  if (environmentId) {
    const locked = current.environments.find((item) => item.id === environmentId);
    if (locked && !environments.some((item) => item.id === locked.id)) {
      environments.push(locked);
    }
  }
  if (environments.length === 0) {
    return [];
  }
  return [{ ...current, environments }];
}

/** A shared live desk is visible when this viewer can use its exchange and mode. */
export function sharedDeskVisible(
  access: ExchangeAccess,
  desk: {
    deskType: string;
    venue: string;
    venueEnvironment: string | null;
  },
): boolean {
  return exchangeCreateAllowed({
    cells: access.cells,
    preview: access.preview,
    deskType: desk.deskType,
    venueId: desk.venue,
    accountMode: "live",
    environmentId: desk.venueEnvironment,
  }).ok;
}

export function environmentAllowedForDesk(
  access: ExchangeAccess | null,
  deskType: string,
  venueId: string,
  environmentId: string,
): boolean {
  if (!access) {
    return true;
  }
  return exchangeCreateAllowed({
    cells: access.cells,
    preview: access.preview,
    deskType,
    venueId,
    accountMode: "live",
    environmentId,
  }).ok;
}

export function viewerMayUseEnvironment(
  access: ExchangeAccess | null,
  venueId: string,
  environmentId: string,
): boolean {
  if (!access) {
    return true;
  }
  return offeredAccountVenues(access).some(
    (venue) =>
      venue.id === venueId &&
      venue.environments.some((environment) => environment.id === environmentId),
  );
}

export function readAvailabilityForm(
  venue: VenueDefinition,
  form: FormData,
): ExchangeAvailabilityCell[] {
  const cells: ExchangeAvailabilityCell[] = [];
  for (const deskType of venue.deskTypes) {
    for (const mode of EXCHANGE_DESK_MODES) {
      const key = `${deskType}:${mode}`;
      const raw = String(form.get(`availability:${key}`) ?? "");
      const choice = exclusiveChoice(
        raw !== "testing" && raw !== "beta" && raw !== "in_development",
        raw === "testing",
        raw === "beta",
        raw === "in_development",
      );
      cells.push({
        venueId: venue.id,
        deskType,
        mode,
        live: choice.live,
        testing: choice.testing,
        beta: choice.beta,
        inDevelopment: choice.inDevelopment,
      });
    }
  }
  return cells;
}
