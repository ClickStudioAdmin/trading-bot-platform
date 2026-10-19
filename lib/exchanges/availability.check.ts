import assert from "node:assert/strict";
import { ADMIN_NAV_LINKS } from "@/lib/site-links";
import {
  availabilityCounts,
  availabilitySetting,
  cellFor,
  deskTypesInSidebarOrder,
  exchangeListDeskTypes,
  connectedVenueChoiceLabel,
  defaultExchangeAvailability,
  deskBetaNotice,
  environmentDeskMode,
  exchangeChoiceLabel,
  exclusiveChoice,
  exchangeCreateAllowed,
  mergeExchangeAvailability,
  offeredConnectionVenues,
  offeredEnvironments,
  offeredVenues,
  parseAvailabilityRow,
  readAvailabilityForm,
} from "./availability";
import { getVenue } from "./venues";

const defaults = defaultExchangeAvailability();
assert.equal(defaults.length, 5 * 3 + 4 * 3);
assert.equal(
  defaults.every(
    (cell) => cell.live && !cell.testing && !cell.beta && !cell.inDevelopment,
  ),
  true,
);
assert.equal(
  cellFor(defaults, "hyperliquid", "cash_and_carry", "paper"),
  null,
);
assert.equal(cellFor(defaults, "bybit", "dca", "demo")?.live, true);

const hidden = mergeExchangeAvailability([
  {
    venueId: "hyperliquid",
    deskType: "flex",
    mode: "demo",
    live: false,
    testing: true,
    beta: false,
    inDevelopment: false,
  },
  {
    venueId: "bybit",
    deskType: "manual",
    mode: "paper",
    live: false,
    testing: true,
    beta: false,
    inDevelopment: false,
  },
  {
    venueId: "bybit",
    deskType: "flex",
    mode: "demo",
    live: false,
    testing: false,
    beta: true,
    inDevelopment: false,
  },
  {
    venueId: "bybit",
    deskType: "dca",
    mode: "paper",
    live: false,
    testing: false,
    beta: false,
    inDevelopment: true,
  },
]);
assert.equal(hidden.length, defaults.length);
assert.equal(cellFor(hidden, "hyperliquid", "flex", "live")?.live, true);
assert.equal(cellFor(hidden, "hyperliquid", "flex", "demo")?.testing, true);
assert.equal(cellFor(hidden, "hyperliquid", "flex", "demo")?.live, false);
assert.equal(cellFor(hidden, "bybit", "manual", "paper")?.live, false);
assert.equal(cellFor(hidden, "bybit", "manual", "paper")?.testing, true);
assert.deepEqual(exclusiveChoice(true, true), {
  live: true,
  testing: false,
  beta: false,
  inDevelopment: false,
});
assert.deepEqual(exclusiveChoice(false, false), {
  live: true,
  testing: false,
  beta: false,
  inDevelopment: false,
});
assert.deepEqual(exclusiveChoice(false, true), {
  live: false,
  testing: true,
  beta: false,
  inDevelopment: false,
});
assert.deepEqual(exclusiveChoice(false, false, true), {
  live: false,
  testing: false,
  beta: true,
  inDevelopment: false,
});
assert.deepEqual(exclusiveChoice(true, false, true), {
  live: true,
  testing: false,
  beta: false,
  inDevelopment: false,
});
assert.deepEqual(exclusiveChoice(false, false, false, true), {
  live: false,
  testing: false,
  beta: false,
  inDevelopment: true,
});
assert.deepEqual(exclusiveChoice(false, true, false, true), {
  live: true,
  testing: false,
  beta: false,
  inDevelopment: false,
});

const publicFlex = exchangeCreateAllowed({
  cells: hidden,
  admin: false,
  deskType: "flex",
  venueId: "hyperliquid",
  accountMode: "live",
  environmentId: "testnet",
});
assert.equal(publicFlex.ok, false);
const adminFlex = exchangeCreateAllowed({
  cells: hidden,
  admin: true,
  deskType: "flex",
  venueId: "hyperliquid",
  accountMode: "live",
  environmentId: "demo",
});
assert.equal(adminFlex.ok, true);
const publicBeta = exchangeCreateAllowed({
  cells: hidden,
  admin: false,
  deskType: "flex",
  venueId: "bybit",
  accountMode: "live",
  environmentId: "demo",
});
assert.equal(publicBeta.ok, true);
const developingDesk = {
  cells: hidden,
  deskType: "dca",
  venueId: "bybit",
  accountMode: "paper" as const,
  environmentId: null,
};
assert.equal(exchangeCreateAllowed({ ...developingDesk, admin: false }).ok, false);
assert.equal(exchangeCreateAllowed({ ...developingDesk, admin: true }).ok, false);
assert.equal(
  deskBetaNotice({
    cells: hidden,
    deskType: "flex",
    venueId: "bybit",
    accountMode: "live",
    environmentId: "demo",
  }),
  "Flex Bots are currently in Beta for Demo mode.",
);
assert.equal(
  deskBetaNotice({
    cells: hidden,
    deskType: "flex",
    venueId: "bybit",
    accountMode: "live",
    environmentId: "live",
  }),
  null,
);
assert.equal(
  deskBetaNotice({
    cells: hidden,
    deskType: "flex",
    venueId: "bybit",
    accountMode: "live",
    environmentId: null,
  }),
  null,
);
assert.equal(
  exchangeChoiceLabel("Bybit", hidden, "bybit", "flex", "demo"),
  "Bybit · Beta",
);
assert.equal(
  exchangeChoiceLabel("Bybit", hidden, "bybit", "flex", "live"),
  "Bybit",
);
const bybitVenue = getVenue("bybit");
assert.ok(bybitVenue);
assert.equal(connectedVenueChoiceLabel(bybitVenue, hidden, "flex"), "Bybit");
const publicLive = exchangeCreateAllowed({
  cells: hidden,
  admin: false,
  deskType: "flex",
  venueId: "hyperliquid",
  accountMode: "live",
  environmentId: "live",
});
assert.equal(publicLive.ok, true);

const testingPaper = exchangeCreateAllowed({
  cells: hidden,
  admin: false,
  deskType: "manual",
  venueId: "bybit",
  accountMode: "paper",
  environmentId: null,
});
assert.equal(testingPaper.ok, false);
const adminPaper = exchangeCreateAllowed({
  cells: hidden,
  admin: true,
  deskType: "manual",
  venueId: "bybit",
  accountMode: "paper",
  environmentId: null,
});
assert.equal(adminPaper.ok, true);

const eitherConnected = exchangeCreateAllowed({
  cells: hidden,
  admin: false,
  deskType: "manual",
  venueId: "bybit",
  accountMode: "live",
  environmentId: null,
});
assert.equal(eitherConnected.ok, true);

const carry = exchangeCreateAllowed({
  cells: hidden,
  admin: true,
  deskType: "cash_and_carry",
  venueId: "hyperliquid",
  accountMode: "paper",
  environmentId: null,
});
assert.equal(carry.ok, false);

assert.equal(environmentDeskMode("testnet"), "demo");
assert.equal(environmentDeskMode("demo"), "demo");
assert.equal(environmentDeskMode("live"), "live");
assert.equal(environmentDeskMode("mainnet"), "live");
assert.equal(environmentDeskMode(null), "live");

const access = { admin: false, cells: hidden };
assert.deepEqual(
  offeredVenues(access, "manual", "paper").map((venue) => venue.id),
  ["hyperliquid"],
);
assert.deepEqual(
  offeredVenues({ admin: true, cells: hidden }, "flex", "connected").map(
    (venue) => venue.id,
  ),
  ["bybit", "hyperliquid"],
);
const hl = getVenue("hyperliquid");
assert.ok(hl);
assert.deepEqual(
  offeredEnvironments(access, hl, "flex").map((environment) => environment.id),
  ["live"],
);
assert.deepEqual(
  offeredEnvironments({ admin: true, cells: hidden }, hl, "flex").map(
    (environment) => environment.id,
  ),
  ["live", "testnet"],
);
const keys = offeredConnectionVenues(access, "flex");
const hlKeys = keys.find((venue) => venue.id === "hyperliquid");
assert.deepEqual(
  hlKeys?.environments.map((environment) => environment.id),
  ["live"],
);

const form = new FormData();
form.set("availability:manual:paper", "live");
form.set("availability:manual:demo", "testing");
form.set("availability:cash_and_carry:live", "live");
form.set("availability:flex:demo", "beta");
form.set("availability:dca:paper", "in_development");
const bybit = getVenue("bybit");
assert.ok(bybit);
const read = readAvailabilityForm(bybit, form);
assert.equal(read.length, 15);
assert.equal(cellFor(read, "bybit", "manual", "paper")?.live, true);
assert.equal(cellFor(read, "bybit", "manual", "paper")?.testing, false);
assert.equal(cellFor(read, "bybit", "manual", "demo")?.testing, true);
assert.equal(cellFor(read, "bybit", "manual", "demo")?.live, false);
assert.equal(cellFor(read, "bybit", "manual", "live")?.live, true);
assert.equal(cellFor(read, "bybit", "manual", "live")?.testing, false);
assert.equal(cellFor(read, "bybit", "flex", "demo")?.beta, true);
assert.equal(cellFor(read, "bybit", "flex", "demo")?.live, false);
assert.equal(cellFor(read, "bybit", "dca", "paper")?.inDevelopment, true);
assert.equal(cellFor(read, "bybit", "dca", "paper")?.live, false);
assert.equal(
  read.every(
    (cell) =>
      Number(cell.live) +
        Number(cell.testing) +
        Number(cell.beta) +
        Number(cell.inDevelopment) ===
      1,
  ),
  true,
);
assert.equal(
  read.some((cell) => cell.deskType === "cash_and_carry" && cell.mode === "live" && cell.live),
  true,
);

assert.equal(parseAvailabilityRow({ venue: "okx", desk_type: "dca", mode: "paper", live: true, testing: false }), null);
assert.equal(
  parseAvailabilityRow({
    venue: "hyperliquid",
    desk_type: "cash_and_carry",
    mode: "paper",
    live: true,
    testing: false,
  }),
  null,
);
const parsed = parseAvailabilityRow({
  venue: "bybit",
  desk_type: "dca",
  mode: "live",
  live: false,
  testing: true,
});
assert.equal(parsed?.testing, true);
assert.equal(parsed?.live, false);
const bothOn = parseAvailabilityRow({
  venue: "bybit",
  desk_type: "dca",
  mode: "paper",
  live: true,
  testing: true,
});
assert.equal(bothOn?.live, true);
assert.equal(bothOn?.testing, false);
assert.equal(bothOn?.beta, false);
const betaRow = parseAvailabilityRow({
  venue: "bybit",
  desk_type: "flex",
  mode: "paper",
  live: false,
  testing: false,
  beta: true,
});
assert.equal(betaRow?.beta, true);
assert.equal(betaRow?.live, false);
assert.equal(betaRow?.inDevelopment, false);
const developingRow = parseAvailabilityRow({
  venue: "bybit",
  desk_type: "dca",
  mode: "demo",
  live: false,
  testing: false,
  beta: false,
  in_development: true,
});
assert.equal(developingRow?.inDevelopment, true);
assert.equal(developingRow?.live, false);
assert.equal(availabilitySetting(hidden, "bybit", "flex", "demo"), "beta");
assert.equal(availabilitySetting(hidden, "bybit", "dca", "paper"), "in_development");

const counts = availabilityCounts("bybit", defaults);
assert.equal(counts.slots, 15);
assert.equal(counts.live, 15);
assert.equal(counts.testing, 0);
assert.equal(availabilitySetting(hidden, "bybit", "manual", "paper"), "testing");
assert.equal(availabilitySetting(hidden, "bybit", "manual", "demo"), "live");
assert.equal(availabilitySetting(hidden, "bybit", "manual", "live"), "live");
assert.equal(availabilitySetting(defaults, "bybit", "dca", "paper"), "live");
assert.equal(availabilitySetting([], "bybit", "dca", "paper"), "live");
assert.deepEqual(
  deskTypesInSidebarOrder([
    "cash_and_carry",
    "manual",
    "flex",
    "signal_follower",
    "dca",
  ]),
  ["flex", "dca", "cash_and_carry", "signal_follower", "manual"],
);
assert.deepEqual(
  deskTypesInSidebarOrder(["manual", "flex", "signal_follower", "dca"]),
  ["flex", "dca", "signal_follower", "manual"],
);
const hyperliquidRows = exchangeListDeskTypes(getVenue("hyperliquid")!);
assert.deepEqual(
  hyperliquidRows.map((row) => row.deskType),
  ["flex", "dca", "cash_and_carry", "signal_follower", "manual"],
);
assert.equal(
  hyperliquidRows.find((row) => row.deskType === "cash_and_carry")?.offered,
  false,
);
assert.equal(
  hyperliquidRows.find((row) => row.deskType === "flex")?.offered,
  true,
);
assert.equal(
  exchangeListDeskTypes(getVenue("bybit")!).every((row) => row.offered),
  true,
);
const manualCounts = availabilityCounts("bybit", hidden, "manual");
assert.equal(manualCounts.slots, 3);
assert.equal(manualCounts.live, 2);
assert.equal(manualCounts.testing, 1);
assert.equal(availabilityCounts("hyperliquid", defaults).slots, 12);

assert.equal(
  ADMIN_NAV_LINKS.some((link) => link.href === "/admin/exchanges" && link.label === "Exchanges"),
  true,
);

console.log("exchange availability checks passed");
