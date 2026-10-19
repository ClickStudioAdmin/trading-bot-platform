import assert from "node:assert/strict";
import {
  bulkDeleteConfirmBody,
  bulkDeleteOrder,
  bulkDeleteSuccess,
  bulkDeskDeleteBlockReason,
  bulkDisableBlockReason,
  bulkDisableConfirmBody,
  bulkDisableSuccess,
  bulkDisableSuccessDetail,
  deskBulkDeleteRowReason,
  parseBulkDeskIds,
  pickBulkDeleteSwitch,
} from "./desk-bulk";

assert.deepEqual(parseBulkDeskIds([" a ", "a", "", " b ", "c.d", "e,f"]), [
  "a",
  "b",
]);

assert.equal(
  bulkDisableBlockReason([
    { name: "Alpha", status: "active" },
    { name: "Beta", status: "active" },
  ]),
  null,
);
assert.equal(
  bulkDisableBlockReason([{ name: "Alpha", status: "inactive" }]),
  "Disable can’t include Alpha. That desk is already inactive.",
);
assert.equal(
  bulkDisableBlockReason([
    { name: "Alpha", status: "inactive" },
    { name: "  ", status: "inactive" },
  ]),
  "Disable can’t include Alpha, Desk. Those desks are already inactive.",
);

assert.equal(
  deskBulkDeleteRowReason({ blocks: [], closeKind: null }),
  null,
);
assert.match(
  deskBulkDeleteRowReason({ blocks: ["open"], closeKind: null }) ?? "",
  /Exit all positions first/,
);
assert.match(
  deskBulkDeleteRowReason({ blocks: [], closeKind: "archive" }) ?? "",
  /Followers keep their copy/,
);
assert.match(
  deskBulkDeleteRowReason({ blocks: [], closeKind: "revoke" }) ?? "",
  /invited members/,
);

const clean = {
  name: "Alpha",
  blocks: [],
  closeKind: null,
} as const;

assert.equal(bulkDeskDeleteBlockReason([clean], 3), null);
assert.equal(
  bulkDeskDeleteBlockReason([clean, { ...clean, name: "Beta" }], 2),
  "Keep at least one desk.",
);
assert.match(
  bulkDeskDeleteBlockReason(
    [{ name: "Alpha", blocks: ["automations"], closeKind: null }],
    4,
  ) ?? "",
  /Delete can’t include Alpha \(Disable bots first\)/,
);
assert.match(
  bulkDeskDeleteBlockReason(
    [
      { name: "Alpha", blocks: ["open"], closeKind: null },
      { name: "Beta", blocks: [], closeKind: "archive" },
    ],
    5,
  ) ?? "",
  /Alpha \(Exit all positions first\), Beta \(Close it from the row/,
);
assert.equal(
  bulkDeskDeleteBlockReason(
    [{ name: "Ghost", found: false, blocks: [], closeKind: null }],
    3,
  ),
  "That desk was not found.",
);
assert.equal(bulkDeskDeleteBlockReason([], 2), null);

assert.match(bulkDisableConfirmBody([{ name: "Alpha", kind: "flex" }]), /Alpha/);
assert.match(
  bulkDisableConfirmBody([
    { name: "Alpha", kind: "copy" },
    { name: "Beta", kind: "copy" },
  ]),
  /Pause copying on these desks/,
);
assert.match(
  bulkDisableConfirmBody([
    { name: "Alpha", kind: "none" },
    { name: "Beta", kind: "none" },
  ]),
  /no bots/,
);
assert.match(
  bulkDisableConfirmBody([
    { name: "Alpha", kind: "dca" },
    { name: "Beta", kind: "flex" },
  ]),
  /Turn every bot off on these desks/,
);

assert.equal(
  bulkDeleteConfirmBody(["Alpha"]),
  "Remove Alpha and its closed history?",
);
assert.equal(
  bulkDeleteConfirmBody(["Alpha", "Beta"]),
  "Remove these desks and their closed history?",
);
assert.equal(bulkDeleteSuccess(1), "Desk deleted.");
assert.equal(bulkDeleteSuccess(3), "3 desks deleted.");
assert.equal(bulkDisableSuccess(1), "Desk disabled.");
assert.equal(bulkDisableSuccess(2), "Desks disabled.");
assert.equal(
  bulkDisableSuccessDetail({ count: 1, closed: 0, cancelled: 0 }),
  "Bots are off. There were no open positions.",
);
assert.equal(
  bulkDisableSuccessDetail({ count: 2, closed: 1, cancelled: 1 }),
  null,
);

assert.deepEqual(bulkDeleteOrder(["a", "b", "c"], "b"), ["a", "c", "b"]);
assert.deepEqual(bulkDeleteOrder(["a", "c"], "b"), ["a", "c"]);
assert.deepEqual(bulkDeleteOrder(["current"], "current"), ["current"]);

const accounts = [
  { id: "paper", mode: "paper" as const },
  { id: "live", mode: "live" as const },
  { id: "other", mode: "live" as const },
];
assert.equal(
  pickBulkDeleteSwitch(accounts, ["live"], "other")?.id,
  "other",
);
assert.equal(
  pickBulkDeleteSwitch(accounts, ["live", "other"], "live")?.id,
  "paper",
);
assert.equal(pickBulkDeleteSwitch(accounts, ["paper", "live", "other"], "paper"), null);

console.log("desk-bulk.check: ok");
