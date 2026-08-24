import assert from "node:assert/strict";
import {
  accountCanHoldConnections,
  enabledVenues,
  getVenue,
  parseVenueCredentials,
  parseVenueEnvironment,
  parseVenueId,
  VENUES,
} from "./venues";

assert.equal(VENUES.length, 1);
assert.equal(enabledVenues().length, 1);
assert.equal(enabledVenues()[0]?.id, "bybit");
assert.equal(getVenue("okx"), null);
assert.equal(getVenue("bybit")?.label, "Bybit");

const bybit = parseVenueId("bybit");
assert.equal(bybit.ok, true);
if (!bybit.ok) {
  throw new Error("bybit should parse");
}
assert.equal(parseVenueId("").ok, false);
assert.equal(parseVenueId("okx").ok, false);
assert.equal(parseVenueId("BYBIT").ok, false);

const mainnet = parseVenueEnvironment(bybit.venue, "mainnet");
assert.equal(mainnet.ok, true);
if (mainnet.ok) {
  assert.equal(mainnet.environment.label, "Mainnet");
}
assert.equal(parseVenueEnvironment(bybit.venue, "demo").ok, true);
assert.equal(parseVenueEnvironment(bybit.venue, "testnet").ok, false);

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

assert.equal(accountCanHoldConnections("live"), true);
assert.equal(accountCanHoldConnections("paper"), false);

const fields = bybit.venue.credentialFields.map((field) => field.key);
assert.deepEqual(fields, ["apiKey", "apiSecret"]);
assert.equal(
  bybit.venue.credentialFields.some((field) => field.key === "passphrase"),
  false,
);

console.log("exchange venue checks passed");
