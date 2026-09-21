import type { DcaPlaybook } from "@/lib/dca/playbook";
import type { PaperLayerFormValues } from "@/lib/engine/rules";
import type { FuturesAutomationFormValues } from "@/lib/futures/automation";
import {
  dcaStatusFromLegs,
  statusOptionsFor,
  type BotDeskKind,
} from "@/lib/bots/status";

const PERPS_ACTION_LABEL: Record<
  FuturesAutomationFormValues["formAction"],
  string
> = {
  buy: "Buy",
  sell: "Sell",
  close_long: "Close long",
  close_short: "Close short",
};

const PERPS_ENTRY_LABEL: Record<string, string> = {
  price: "Price",
  webhook: "Signal",
  indicator: "Indicator",
  trend: "Trend",
};

const DCA_START_LABEL: Record<string, string> = {
  immediate: "Immediate",
  price: "Price",
  webhook: "Signal",
  indicator: "Indicator",
  trend: "Trend",
};

export function botModeLabel(desk: BotDeskKind, mode: string): string {
  return (
    statusOptionsFor(desk).find((option) => option.value === mode)?.label ??
    mode
  );
}

export function paperBotPair(): string {
  return "Carry";
}

export function paperBotSummary(layer: PaperLayerFormValues): string {
  const bits: string[] = [];
  if (layer.minApr.trim()) {
    bits.push(`Min APR ${layer.minApr}%`);
  }
  const minDte = layer.minDte.trim();
  const maxDte = layer.maxDte.trim();
  if (minDte || maxDte) {
    bits.push(`DTE ${minDte || "0"}–${maxDte || "∞"}`);
  }
  bits.push(layer.sizeType === "fixed" ? `${layer.notionalUsdt} USDT` : "Dynamic size");
  if (layer.maxOpenCount.trim()) {
    bits.push(`Max ${layer.maxOpenCount}`);
  }
  return bits.join(" · ");
}

export function perpsBotPair(rule: FuturesAutomationFormValues): string {
  return `${rule.symbol} · ${PERPS_ACTION_LABEL[rule.formAction]}`;
}

export function perpsBotSummary(rule: FuturesAutomationFormValues): string {
  const entry = PERPS_ENTRY_LABEL[rule.entrySource] ?? "Price";
  const size = rule.size.trim()
    ? `${rule.size}${rule.sizeUnit === "usdt" ? " USDT" : ""}`
    : "";
  return [PERPS_ACTION_LABEL[rule.formAction], entry, rule.orderType, size]
    .filter(Boolean)
    .join(" · ");
}

export function dcaBotPair(playbook: Pick<DcaPlaybook, "symbol" | "direction">): string {
  const side =
    playbook.direction === "both"
      ? "Both"
      : playbook.direction === "short"
        ? "Short"
        : "Long";
  return `${playbook.symbol} · ${side}`;
}

export function dcaListStatus(playbook: DcaPlaybook): string {
  return botModeLabel(
    "dca",
    dcaStatusFromLegs({
      armed:
        playbook.long.status === "armed" || playbook.short.status === "armed",
      stopAdding:
        playbook.long.status === "stop_adding" ||
        playbook.short.status === "stop_adding",
    }),
  );
}

export function dcaBotSummary(playbook: DcaPlaybook): string {
  const start = DCA_START_LABEL[playbook.startKind] ?? "Immediate";
  const clips =
    playbook.maxClips != null
      ? `${playbook.maxClips} clips`
      : playbook.maxValue != null
        ? `Max ${playbook.maxValue}`
        : "";
  const dip = playbook.dipPct != null ? `${playbook.dipPct}% dip` : "";
  return [start, clips, dip].filter(Boolean).join(" · ");
}
