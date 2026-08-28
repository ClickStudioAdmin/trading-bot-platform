import assert from "node:assert/strict";
import { pathSkipsOnboarding, WELCOME_PATH } from "./onboarding-path";

assert.equal(WELCOME_PATH, "/welcome");
assert.equal(pathSkipsOnboarding("/welcome"), true);
assert.equal(pathSkipsOnboarding("/sign-in"), true);
assert.equal(pathSkipsOnboarding("/api/tick"), true);
assert.equal(pathSkipsOnboarding("/account"), false);
assert.equal(pathSkipsOnboarding("/strategies"), false);
assert.equal(pathSkipsOnboarding("/"), false);
assert.equal(pathSkipsOnboarding(""), false);
