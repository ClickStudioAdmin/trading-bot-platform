import assert from "node:assert/strict";
import { ADMIN_NAV_LINKS } from "@/lib/site-links";
import { SYSTEM_JOBS, systemJobIds } from "./system-jobs";

const ids = systemJobIds();
assert.equal(new Set(ids).size, ids.length);
assert.equal(ids.includes("event-log-purge"), true);
assert.equal(ids.includes("closed-desk-retention"), true);
assert.equal(ids.includes("supabase-keepalive"), true);

const logs = SYSTEM_JOBS.find((job) => job.id === "event-log-purge");
assert.equal(logs?.detail.includes("60 days"), true);
assert.equal(logs?.leaves.includes("Inbox"), true);

const desks = SYSTEM_JOBS.find((job) => job.id === "closed-desk-retention");
assert.equal(desks?.detail.includes("Six months"), true);
assert.equal(desks?.cadence.includes("desk_close_retention"), true);

const labels = ADMIN_NAV_LINKS.map((link) => link.label);
const systemAt = labels.indexOf("System");
const logsAt = labels.indexOf("Logs");
assert.equal(systemAt >= 0 && logsAt === systemAt + 1, true);
assert.equal(ADMIN_NAV_LINKS[systemAt]?.href, "/admin/system");

console.log("system jobs checks passed");
