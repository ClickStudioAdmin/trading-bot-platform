import assert from "node:assert/strict";
import { templateIdsDeletedWithFolder } from "./folder-delete";

const own = { id: "own", visibility: "user" as const, userId: "owner" };
const platform = { id: "plat", visibility: "platform" as const, userId: null };
const other = { id: "other", visibility: "user" as const, userId: "someone" };
const backtested = {
  id: "bt",
  visibility: "backtested" as const,
  userId: "owner",
};

assert.deepEqual(
  templateIdsDeletedWithFolder({
    folderVisibility: "user",
    folderUserId: "owner",
    actorId: "owner",
    isAdmin: false,
    templates: [own, platform, other, backtested, own],
  }),
  ["own"],
);

assert.deepEqual(
  templateIdsDeletedWithFolder({
    folderVisibility: "user",
    folderUserId: "owner",
    actorId: "admin",
    isAdmin: true,
    templates: [own, platform],
  }),
  ["own"],
);

assert.deepEqual(
  templateIdsDeletedWithFolder({
    folderVisibility: "platform",
    folderUserId: null,
    actorId: "admin",
    isAdmin: true,
    templates: [platform, own],
  }),
  ["plat"],
);

assert.deepEqual(
  templateIdsDeletedWithFolder({
    folderVisibility: "platform",
    folderUserId: null,
    actorId: "member",
    isAdmin: false,
    templates: [platform],
  }),
  [],
);

assert.deepEqual(
  templateIdsDeletedWithFolder({
    folderVisibility: "user",
    folderUserId: null,
    actorId: "owner",
    isAdmin: false,
    templates: [own],
  }),
  [],
);

console.log("folder delete checks passed");
