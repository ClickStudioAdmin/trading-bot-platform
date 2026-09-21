import assert from "node:assert/strict";
import {
  botModeLabel,
  dcaBotPair,
  dcaBotSummary,
  dcaListStatus,
  paperBotPair,
  paperBotSummary,
  perpsBotPair,
  perpsBotSummary,
} from "./automations-list";
import { defaultFuturesAutomationForm } from "@/lib/futures/automation";
import { paperConfigToFormValues, defaultPaperLayer } from "@/lib/engine/rules";
import type { DcaPlaybook } from "@/lib/dca/playbook";

assert.equal(botModeLabel("cnc", "reduce_only"), "Reduce only");
assert.equal(botModeLabel("dca", "stop_adding"), "Stop adding");
assert.equal(paperBotPair(), "Carry");

const paper = paperConfigToFormValues({
  enabled: false,
  layers: [
    {
      ...defaultPaperLayer(0),
      id: 4,
      name: "Carry A",
      minNetApr: 0.12,
      minDte: 10,
      maxDte: 40,
      sizeType: "fixed",
      notionalUsdt: 2500,
      maxOpenCount: 3,
    },
  ],
}).layers[0]!;
assert.equal(paperBotSummary(paper), "Min APR 12% · DTE 10–40 · 2500 USDT · Max 3");

const perps = {
  ...defaultFuturesAutomationForm(0, "ETHUSDT"),
  formAction: "sell" as const,
  entrySource: "indicator" as const,
  orderType: "market" as const,
  size: "0.5",
  sizeUnit: "qty" as const,
};
assert.equal(perpsBotPair(perps), "ETHUSDT · Sell");
assert.equal(perpsBotSummary(perps), "Sell · Indicator · market · 0.5");

const playbook = {
  symbol: "BTCUSDT",
  direction: "both",
  startKind: "price",
  maxClips: 5,
  dipPct: 2,
  long: { status: "armed" },
  short: { status: "idle" },
} as unknown as DcaPlaybook;
assert.equal(dcaBotPair(playbook), "BTCUSDT · Both");
assert.equal(dcaBotSummary(playbook), "Price · 5 clips · 2% dip");
assert.equal(dcaListStatus(playbook), "Active");
