import assert from "node:assert/strict";
import { ADMIN_NAV_LINKS } from "@/lib/site-links";
import {
  availabilityCounts,
  cellFor,
  defaultExchangeAvailability,
  environmentDeskMode,
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
  defaults.every((cell) => cell.live && !cell.testing),
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
  },
  {
    venueId: "bybit",
    deskType: "manual",
    mode: "paper",
    live: false,
    testing: false,
  },
]);
assert.equal(hidden.length, defaults.length);
assert.equal(cellFor(hidden, "hyperliquid", "flex", "live")?.live, true);
assert.equal(cellFor(hidden, "hyperliquid", "flex", "demo")?.testing, true);
assert.equal(cellFor(hidden, "hyperliquid", "flex", "demo")?.live, false);
assert.equal(cellFor(hidden, "bybit", "manual", "paper")?.live, false);

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
const publicLive = exchangeCreateAllowed({
  cells: hidden,
  admin: false,
  deskType: "flex",
  venueId: "hyperliquid",
  accountMode: "live",
  environmentId: "live",
});
assert.equal(publicLive.ok, true);

const neither = exchangeCreateAllowed({
  cells: hidden,
  admin: true,
  deskType: "manual",
  venueId: "bybit",
  accountMode: "paper",
  environmentId: null,
});
assert.equal(neither.ok, false);

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
form.set("live:manual:paper", "1");
form.set("testing:manual:demo", "1");
form.set("live:cash_and_carry:live", "1");
const bybit = getVenue("bybit");
assert.ok(bybit);
const read = readAvailabilityForm(bybit, form);
assert.equal(read.length, 15);
assert.equal(cellFor(read, "bybit", "manual", "paper")?.live, true);
assert.equal(cellFor(read, "bybit", "manual", "paper")?.testing, false);
assert.equal(cellFor(read, "bybit", "manual", "demo")?.testing, true);
assert.equal(cellFor(read, "bybit", "manual", "live")?.live, false);
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

const counts = availabilityCounts("bybit", defaults);
assert.equal(counts.slots, 15);
assert.equal(counts.live, 15);
assert.equal(counts.testing, 0);
assert.equal(availabilityCounts("hyperliquid", defaults).slots, 12);

assert.equal(
  ADMIN_NAV_LINKS.some((link) => link.href === "/admin/exchanges" && link.label === "Exchanges"),
  true,
);

console.log("exchange availability checks passed");
