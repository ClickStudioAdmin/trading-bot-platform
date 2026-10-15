import assert from "node:assert/strict";
import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import { defaultPaperLayer } from "@/lib/engine/rules";
import {
  snapshotDcaRecipe,
  snapshotPaperRecipe,
  snapshotPerpsRecipe,
} from "@/lib/templates/recipe";
import {
  backtestListedSections,
  recipeParamRows,
  recipeParamSections,
  templateParamSections,
} from "./param-sections";

function dcaSeed() {
  const form = new FormData();
  form.set("name", "Study seed");
  form.set("symbol", "BTCUSDT");
  form.set("direction", "long");
  form.set("startKind", "immediate");
  form.set("clipSize", "1");
  form.set("sizeUnit", "qty");
  form.set("takeProfitPct", "10");
  const parsed = parseDcaPlaybookForm(form);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error("expected DCA parse");
  }
  return snapshotDcaRecipe(parsed.config);
}

const dca = dcaSeed();
const sections = recipeParamSections(dca);
assert.deepEqual(
  sections.map((section) => section.title),
  ["General", "Entry Conditions", "Position Sizing", "Exit Conditions"],
);
const general = sections[0]?.groups[0]?.rows.map((row) => row.label);
assert.deepEqual(general, ["Name", "Contract", "Direction"]);
const sizing = sections[2]?.groups.map((group) => group.title);
assert.deepEqual(sizing, [
  "Maximum Exposure",
  "Initial Order Size",
  "Additional Order Types",
  "Additional Order Scaling",
]);
const labels = recipeParamRows(dca).map((row) => row.label);
assert.equal(labels.includes("Type"), false);
assert.equal(labels.includes("Take profit"), false);
assert.ok(labels.includes("Basis"));
assert.ok(labels.includes("Target %"));
assert.equal(
  labels.includes("Trigger %"),
  false,
  "trailing fields stay hidden while Trailing stop is off",
);
assert.equal(
  recipeParamRows(dca).find((row) => row.label === "Trailing stop")?.value,
  "Off",
);
assert.equal(
  recipeParamRows(dca).find((row) => row.label === "Stop loss")?.value,
  "Off",
);
assert.equal(
  recipeParamRows(dca).find((row) => row.label === "Hard Exit Condition")?.value,
  "Off",
);

const listed = backtestListedSections(dca, {
  name: "October ETH",
  leverage: 10,
  startingUsdt: 10000,
  fromMs: Date.UTC(2021, 9, 2),
  toMs: Date.UTC(2024, 0, 1),
});
assert.equal(listed[0]?.title, "Market window");
assert.equal(listed[1]?.title, "General");
assert.deepEqual(
  listed[0]?.groups[0]?.rows.map((row) => row.label),
  ["Name", "Start date", "End date", "Initial account balance", "Leverage"],
);
assert.equal(listed[0]?.groups[0]?.rows[0]?.value, "October ETH");
assert.deepEqual(
  listed[1]?.groups[0]?.rows.map((row) => row.label),
  ["Contract", "Direction"],
);

const perps = snapshotPerpsRecipe({
  name: "Perps rule",
  symbol: "ETHUSDT",
  action: "buy",
  closeSide: null,
  orderType: "market",
  sizeUnit: "qty",
  size: 2,
  limitPrice: null,
  entrySource: "price",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: 100,
  skipIfOpen: true,
  tpsl: null,
  trailing: null,
});
const perpsSections = recipeParamSections(perps);
assert.deepEqual(
  perpsSections.map((section) => section.title),
  ["General", "Long entry", "Position Sizing", "Exit Conditions"],
);
assert.deepEqual(
  perpsSections[0]?.groups[0]?.rows.map((row) => row.label),
  ["Name", "Contract", "Direction"],
);
assert.equal(
  perpsSections[1]?.groups[0]?.rows[0]?.value,
  "Price cross",
);
assert.equal(
  recipeParamRows(perps).find((row) => row.label === "Secondary Entry Condition")
    ?.value,
  "Off",
);
const orRecipe = snapshotPerpsRecipe({
  name: "Or entry",
  symbol: "ETHUSDT",
  action: "buy",
  closeSide: null,
  orderType: "market",
  sizeUnit: "qty",
  size: 1,
  limitPrice: null,
  entrySource: "price",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: 100,
  skipIfOpen: true,
  tpsl: null,
  trailing: null,
  confirm: null,
  entryStack: {
    leaves: [
      {
        kind: "filter",
        spec: {
          kind: "ema",
          timeframe: "60",
          compare: "gte",
          level: null,
          period: 21,
          multiplier: null,
        },
      },
    ],
    joins: ["or"],
  },
});
assert.match(
  recipeParamRows(orRecipe).find((row) => row.label === "Or")?.value ?? "",
  /EMA 21/,
);
assert.equal(
  recipeParamRows(orRecipe).some((row) => row.label === "Secondary Entry Condition"),
  false,
);
assert.equal(
  recipeParamRows(perps).find((row) => row.label === "Take profit")?.value,
  "Off",
);
const closeRecipe = snapshotPerpsRecipe({
  name: "Close",
  symbol: "ETHUSDT",
  action: "flatten",
  closeSide: "long",
  orderType: "market",
  sizeUnit: "qty",
  size: null,
  limitPrice: null,
  entrySource: "price",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: 1,
  skipIfOpen: true,
  tpsl: null,
  trailing: null,
});
assert.equal(
  recipeParamSections(closeRecipe).some(
    (section) => section.title === "Exit Conditions",
  ),
  false,
);
assert.equal(
  recipeParamRows(closeRecipe).find((row) => row.label === "Qty to close")?.value,
  "All",
);

const templateDca = templateParamSections(dca);
assert.deepEqual(
  templateDca[0]?.groups[0]?.rows.map((row) => row.label),
  ["Contract", "Direction"],
);
assert.equal(
  templateDca.flatMap((section) => section.groups.flatMap((group) => group.rows)).some(
    (row) => row.label === "Name",
  ),
  false,
);

const paper = snapshotPaperRecipe({
  ...defaultPaperLayer(0),
  name: "Core carry",
  sizeType: "fixed",
  exitSizeType: "fixed",
  notionalUsdt: 250,
  minNetApr: 0.1,
  minDte: 7,
  maxOpenCount: 2,
  stopLossPct: -0.02,
});
const paperSections = templateParamSections(paper);
assert.deepEqual(
  paperSections.map((section) => section.title),
  ["Entry Conditions", "Position Sizing", "Exit Conditions"],
);
const paperRows = paperSections.flatMap((section) =>
  section.groups.flatMap((group) => group.rows),
);
assert.equal(paperRows.find((row) => row.label === "Name"), undefined);
assert.equal(paperRows.find((row) => row.label === "Min APR %")?.value, "10%");
assert.equal(paperRows.find((row) => row.label === "Min DTE")?.value, "7");
assert.equal(paperRows.find((row) => row.label === "Max DTE")?.value, "Off");
assert.equal(
  paperRows.find((row) => row.label === "Order size (USDT)")?.value,
  "250",
);
assert.equal(
  paperRows.find((row) => row.label === "Take profit")?.value,
  "Off",
);
assert.equal(
  paperRows.find((row) => row.label === "Stop loss %")?.value,
  "2%",
);

console.log("backtest param section checks passed");
