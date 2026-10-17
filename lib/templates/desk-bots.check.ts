import assert from "node:assert/strict";
import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import { defaultPaperLayer } from "@/lib/engine/rules";
import {
  snapshotDcaRecipe,
  snapshotPaperRecipe,
  snapshotPerpsRecipe,
} from "@/lib/templates/recipe";
import {
  templateBotLinkLabel,
  templateBotLinksByTemplate,
  type TemplateDeskBot,
} from "@/lib/templates/desk-bots";

function dcaRecipe(name: string, symbol: string) {
  const form = new FormData();
  form.set("name", name);
  form.set("symbol", symbol);
  form.set("direction", "long");
  form.set("startKind", "immediate");
  form.set("clipSize", "1");
  form.set("sizeUnit", "qty");
  const parsed = parseDcaPlaybookForm(form);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error("expected DCA parse");
  }
  return snapshotDcaRecipe(parsed.config);
}

const btc = dcaRecipe("DCA Test", "BTCUSDT");
const eth = dcaRecipe("Other", "ETHUSDT");
const perps = snapshotPerpsRecipe({
  name: "Buy dip",
  symbol: "BTCUSDT",
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
});
const carry = snapshotPaperRecipe({
  ...defaultPaperLayer(0),
  id: 4,
  name: "Core carry",
  notionalUsdt: 250,
});

const bots: TemplateDeskBot[] = [
  {
    id: "pb-1",
    name: "Renamed bot",
    deskId: "desk-b",
    deskName: "Main",
    deskType: "dca",
    recipe: { ...btc, name: "Renamed bot" },
  },
  {
    id: "pb-2",
    name: "ETH bot",
    deskId: "desk-b",
    deskName: "Main",
    deskType: "dca",
    recipe: eth,
  },
  {
    id: "pb-3",
    name: "Same settings",
    deskId: "desk-a",
    deskName: "Alpha",
    deskType: "dca",
    recipe: { ...btc, name: "Same settings" },
  },
  {
    id: "rule-1",
    name: "Buy dip",
    deskId: "desk-p",
    deskName: "Perps",
    deskType: "flex",
    recipe: perps,
  },
  {
    id: "4",
    name: "Core carry",
    deskId: "desk-c",
    deskName: "Carry desk",
    deskType: "cash_and_carry",
    recipe: carry,
  },
];

const links = templateBotLinksByTemplate(
  [
    { id: "tpl-btc", deskType: "dca", recipe: btc },
    { id: "tpl-eth", deskType: "dca", recipe: eth },
    { id: "tpl-perps", deskType: "flex", recipe: perps },
    { id: "tpl-carry", deskType: "cash_and_carry", recipe: carry },
    { id: "tpl-none", deskType: "dca", recipe: { ...btc, symbol: "SOLUSDT" } },
  ],
  bots,
);

assert.deepEqual(
  links["tpl-btc"]?.map((bot) => templateBotLinkLabel(bot)),
  ["Renamed bot", "Same settings"],
);
assert.equal(
  links["tpl-btc"]?.[0]?.href,
  "/strategies/futures/automations?desk=desk-b#bot-pb-1",
);
assert.equal(
  links["tpl-btc"]?.[1]?.href,
  "/strategies/futures/automations?desk=desk-a#bot-pb-3",
);
assert.deepEqual(
  links["tpl-eth"]?.map((bot) => bot.id),
  ["pb-2"],
);
assert.equal(
  links["tpl-perps"]?.[0]?.href,
  "/strategies/futures/automations?desk=desk-p#bot-rule-1",
);
assert.equal(
  links["tpl-carry"]?.[0]?.href,
  "/strategies/cash-and-carry/automations?desk=desk-c#bot-4",
);
assert.equal(links["tpl-none"], undefined);
assert.equal(links["tpl-perps"]?.some((bot) => bot.id === "pb-1"), false);

console.log("template desk bot checks passed");
