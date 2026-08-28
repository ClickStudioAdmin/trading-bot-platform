import assert from "node:assert/strict";
import { defaultPaperLayer } from "@/lib/engine/rules";
import { snapshotPaperRecipe } from "./recipe";
import {
  buildTemplateLibraryFile,
  parseShareEmail,
  parseTemplateLibraryJson,
  planLibraryImport,
  selectLibraryExport,
  uniqueLibraryName,
} from "./transfer";

assert.equal(uniqueLibraryName("Core", []), "Core");
assert.equal(uniqueLibraryName("Core", ["Core"]), "Core (import)");
assert.equal(
  uniqueLibraryName("Core", ["Core", "Core (import)"]),
  "Core (import 2)",
);
assert.equal(parseShareEmail("  Ada@Click.studio ").ok, true);
assert.equal(parseShareEmail("not-an-email").ok, false);

const recipe = snapshotPaperRecipe({
  ...defaultPaperLayer(0),
  name: "Carry core",
  notionalUsdt: 500,
});

const template = {
  id: "tpl-1",
  name: "Carry core",
  description: "Main set",
  deskType: "cash_and_carry" as const,
  recipe,
  recipeVersion: 1,
};

const set = {
  id: "set-1",
  name: "Carry pack",
  description: null,
  deskType: "cash_and_carry" as const,
  items: [{ templateId: "tpl-1" }, { templateId: "missing" }],
};

const file = buildTemplateLibraryFile({
  templates: [template],
  sets: [set],
  now: new Date("2026-08-28T02:00:00.000Z"),
});
assert.equal(file.format, "tbp.automation-templates");
assert.deepEqual(file.sets[0]?.items, ["tpl-1"]);

const pickedTemplates = selectLibraryExport(
  { templates: [template], sets: [set] },
  { kind: "template", ids: ["tpl-1"] },
);
assert.equal(pickedTemplates.templates.length, 1);
assert.equal(pickedTemplates.sets.length, 0);

const pickedFolders = selectLibraryExport(
  { templates: [template, { ...template, id: "tpl-2", name: "Other" }], sets: [set] },
  { kind: "folder", ids: ["set-1"] },
);
assert.equal(pickedFolders.sets.length, 1);
assert.deepEqual(
  pickedFolders.templates.map((row) => row.id),
  ["tpl-1"],
);

const roundTrip = parseTemplateLibraryJson(JSON.stringify(file));
assert.equal(roundTrip.ok, true);
if (!roundTrip.ok) {
  throw new Error("expected parse to succeed");
}

const plan = planLibraryImport(roundTrip.file, {
  templates: [{ deskType: "cash_and_carry", name: "Carry core" }],
  sets: [{ deskType: "cash_and_carry", name: "Carry pack" }],
});
assert.equal(plan.templates[0]?.name, "Carry core (import)");
assert.equal(plan.sets[0]?.name, "Carry pack (import)");
assert.deepEqual(plan.sets[0]?.sourceItemIds, ["tpl-1"]);
assert.ok(plan.notes.some((note) => note.includes("Renamed template")));

assert.equal(parseTemplateLibraryJson("{").ok, false);
assert.equal(parseTemplateLibraryJson(JSON.stringify({ format: "nope" })).ok, false);

const skipped = parseTemplateLibraryJson(
  JSON.stringify({
    format: "tbp.automation-templates",
    version: 1,
    templates: [{ id: "bad", name: "x", deskType: "dca", recipe: { name: "x" } }],
    sets: [],
  }),
);
assert.equal(skipped.ok, false);

console.log("template library transfer checks passed");
