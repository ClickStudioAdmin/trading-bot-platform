import assert from "node:assert/strict";
import {
  accountCanHoldConnections,
  credentialsCompleteForVenue,
  connectionFitsDesk,
  connectionsForDeskBind,
  enabledVenues,
  getVenue,
  parseConnectionVenueId,
  parseStoredVenueEnvironment,
  parseStoredVenueId,
  parseVenueCredentials,
  parseVenueEnvironment,
  parseVenueId,
  venueAllowsDeskType,
  venuesForDeskType,
  VENUES,
} from "./venues";

assert.equal(VENUES.length, 2);
assert.equal(enabledVenues().length, 2);
assert.deepEqual(
  enabledVenues().map((row) => row.id),
  ["bybit", "hyperliquid"],
);
assert.equal(getVenue("okx"), null);
assert.equal(getVenue("bybit")?.label, "Bybit");
assert.equal(getVenue("hyperliquid")?.label, "Hyperliquid");

const bybit = parseVenueId("bybit");
assert.equal(bybit.ok, true);
if (!bybit.ok) {
  throw new Error("bybit should parse");
}
assert.equal(bybit.venue.positionMode, "hedge");
assert.equal(bybit.venue.quote, "USDT");
assert.equal(bybit.venue.symbolKind, "linear_usdt");
assert.equal(bybit.venue.datedCarry, true);
assert.equal(bybit.venue.dcaBoth, true);
assert.equal(bybit.venue.connectionsEnabled, true);
assert.equal(venueAllowsDeskType(bybit.venue, "cash_and_carry"), true);
assert.deepEqual(
  venuesForDeskType("cash_and_carry").map((row) => row.id),
  ["bybit"],
);

const hl = parseVenueId("hyperliquid");
assert.equal(hl.ok, true);
if (!hl.ok) {
  throw new Error("hyperliquid should parse");
}
assert.equal(hl.venue.positionMode, "one_way");
assert.equal(hl.venue.quote, "USDC");
assert.equal(hl.venue.symbolKind, "coin");
assert.equal(hl.venue.datedCarry, false);
assert.equal(hl.venue.dcaBoth, false);
assert.equal(hl.venue.connectionsEnabled, true);
assert.equal(venueAllowsDeskType(hl.venue, "cash_and_carry"), false);
assert.equal(venueAllowsDeskType(hl.venue, "dca"), true);
assert.equal(venueAllowsDeskType(hl.venue, "perps_bots"), true);
assert.equal(venueAllowsDeskType(bybit.venue, "perps_bots"), true);
assert.equal(venuesForDeskType("dca").some((row) => row.id === "hyperliquid"), true);
assert.equal(parseConnectionVenueId("hyperliquid").ok, true);
assert.equal(parseConnectionVenueId("bybit").ok, true);

assert.equal(parseVenueId("").ok, false);
assert.equal(parseVenueId("okx").ok, false);
assert.equal(parseVenueId("BYBIT").ok, false);
assert.equal(parseStoredVenueId(""), "bybit");
assert.equal(parseStoredVenueId("hyperliquid"), "hyperliquid");

const liveEnv = parseVenueEnvironment(bybit.venue, "live");
assert.equal(liveEnv.ok, true);
if (liveEnv.ok) {
  assert.equal(liveEnv.environment.id, "live");
  assert.equal(liveEnv.environment.label, "Live");
  assert.equal(liveEnv.environment.host, "https://api.bybit.com");
}
const aliased = parseVenueEnvironment(bybit.venue, "mainnet");
assert.equal(aliased.ok, true);
if (aliased.ok) {
  assert.equal(aliased.environment.id, "live");
}
assert.equal(parseVenueEnvironment(bybit.venue, "production").ok, true);
assert.equal(parseVenueEnvironment(bybit.venue, "demo").ok, true);
assert.equal(parseVenueEnvironment(bybit.venue, "testnet").ok, false);

const hlDemo = parseVenueEnvironment(hl.venue, "demo");
assert.equal(hlDemo.ok, true);
if (hlDemo.ok) {
  assert.equal(hlDemo.environment.id, "testnet");
  assert.equal(hlDemo.environment.label, "Hyperliquid Testnet (demo)");
  assert.equal(
    hlDemo.environment.host,
    "https://api.hyperliquid-testnet.xyz",
  );
}
assert.equal(parseVenueEnvironment(hl.venue, "testnet").ok, true);
assert.equal(parseStoredVenueEnvironment("hyperliquid", "demo"), "testnet");
assert.equal(parseStoredVenueEnvironment("bybit", ""), null);

const creds = parseVenueCredentials(bybit.venue, {
  apiKey: "  abc  ",
  apiSecret: "secret",
});
assert.equal(creds.ok, true);
if (creds.ok) {
  assert.deepEqual(creds.credentials, { apiKey: "abc", apiSecret: "secret" });
}
assert.equal(parseVenueCredentials(bybit.venue, { apiKey: "abc" }).ok, false);
assert.equal(
  parseVenueCredentials(bybit.venue, { apiKey: "abc", apiSecret: "  " }).ok,
  false,
);
assert.equal(parseVenueCredentials(bybit.venue, null).ok, false);

const hlCreds = parseVenueCredentials(hl.venue, {
  accountAddress: "0xabc",
  agentKey: "0xdef",
});
assert.equal(hlCreds.ok, true);

assert.equal(
  credentialsCompleteForVenue("bybit", { apiKey: "a", apiSecret: "b" }),
  true,
);
assert.equal(
  credentialsCompleteForVenue("hyperliquid", {
    accountAddress: "0xabc",
    agentKey: "0xdef",
  }),
  true,
);
assert.equal(
  credentialsCompleteForVenue("hyperliquid", { apiKey: "a", apiSecret: "b" }),
  false,
);
assert.equal(accountCanHoldConnections("live"), true);
assert.equal(accountCanHoldConnections("paper"), false);

const fields = bybit.venue.credentialFields.map((field) => field.key);
assert.deepEqual(fields, ["apiKey", "apiSecret"]);
assert.equal(
  bybit.venue.credentialFields.some((field) => field.key === "passphrase"),
  false,
);
assert.deepEqual(
  hl.venue.credentialFields.map((field) => field.key),
  ["accountAddress", "agentKey"],
);

assert.equal(
  connectionFitsDesk({
    deskVenue: "bybit",
    deskEnvironment: null,
    connectionVenue: "bybit",
    connectionEnvironment: "demo",
  }).ok,
  true,
);
assert.equal(
  connectionFitsDesk({
    deskVenue: "bybit",
    deskEnvironment: "demo",
    connectionVenue: "bybit",
    connectionEnvironment: "live",
  }).ok,
  false,
);
assert.equal(
  connectionFitsDesk({
    deskVenue: "hyperliquid",
    deskEnvironment: "testnet",
    connectionVenue: "hyperliquid",
    connectionEnvironment: "demo",
  }).ok,
  true,
);
assert.equal(
  connectionFitsDesk({
    deskVenue: "hyperliquid",
    deskEnvironment: "testnet",
    connectionVenue: "bybit",
    connectionEnvironment: "demo",
  }).ok,
  false,
);

const bindOptions = connectionsForDeskBind(
  [
    { id: "a", venue: "bybit", environment: "demo", status: "active" },
    { id: "b", venue: "bybit", environment: "live", status: "active" },
    { id: "c", venue: "hyperliquid", environment: "testnet", status: "active" },
  ],
  { venue: "bybit", venueEnvironment: "demo" },
);
assert.deepEqual(
  bindOptions.map((row) => row.id),
  ["a"],
);

console.log("exchange venue checks passed");
