import type { ExitReason, PaperEngineLayer } from "@/lib/engine/decide";

export type TradeSource = "manual" | "engine";
export type CloseReason = ExitReason;

export type PaperCarryAutomation = {
  entryMinNetApr: number | null;
  entryMinDte: number | null;
  entryMaxDte: number | null;
  entryMinCapacityUsdt: number | null;
  closeMaxDte: number | null;
  closeMinNetApr: number | null;
  takeProfitPct: number | null;
  stopLossPct: number | null;
};

export const EMPTY_AUTOMATION: PaperCarryAutomation = {
  entryMinNetApr: null,
  entryMinDte: null,
  entryMaxDte: null,
  entryMinCapacityUsdt: null,
  closeMaxDte: null,
  closeMinNetApr: null,
  takeProfitPct: null,
  stopLossPct: null,
};

export function automationFromLayer(
  layer: PaperEngineLayer,
): PaperCarryAutomation {
  return {
    entryMinNetApr: layer.minNetApr,
    entryMinDte: layer.minDte,
    entryMaxDte: layer.maxDte,
    entryMinCapacityUsdt: layer.minCapacityUsdt,
    closeMaxDte: layer.closeMaxDte,
    closeMinNetApr: layer.closeMinNetApr,
    takeProfitPct: layer.takeProfitPct,
    stopLossPct: layer.stopLossPct,
  };
}

export function automationInsertColumns(automation: PaperCarryAutomation) {
  return {
    entry_min_net_apr: automation.entryMinNetApr,
    entry_min_dte: automation.entryMinDte,
    entry_max_dte: automation.entryMaxDte,
    entry_min_capacity_usdt: automation.entryMinCapacityUsdt,
    close_max_dte: automation.closeMaxDte,
    close_min_net_apr: automation.closeMinNetApr,
    take_profit_pct: automation.takeProfitPct,
    stop_loss_pct: automation.stopLossPct,
  };
}

export function formatEntryTriggers(automation: PaperCarryAutomation): string[] {
  const lines: string[] = [];
  const minApr = formatPctPoints(automation.entryMinNetApr);
  if (minApr) {
    lines.push(`Min APR ${minApr}`);
  }
  const dte = formatDteRange(automation.entryMinDte, automation.entryMaxDte);
  if (dte) {
    lines.push(dte);
  }
  if (automation.entryMinCapacityUsdt !== null) {
    lines.push(
      `Min book value $${Math.round(automation.entryMinCapacityUsdt).toLocaleString("en-US")}`,
    );
  }
  return lines;
}

export function formatExitTriggers(automation: PaperCarryAutomation): string[] {
  const lines: string[] = [];
  if (automation.closeMaxDte !== null) {
    lines.push(`Close DTE ≤ ${automation.closeMaxDte}`);
  }
  const closeApr = formatPctPoints(automation.closeMinNetApr);
  if (closeApr) {
    lines.push(`Close APR below ${closeApr}`);
  }
  const takeProfit = formatPctPoints(automation.takeProfitPct);
  if (takeProfit) {
    lines.push(`Take profit ${takeProfit}`);
  }
  const stopLoss = formatPctPoints(
    automation.stopLossPct === null ? null : Math.abs(automation.stopLossPct),
  );
  if (stopLoss) {
    lines.push(`Stop loss ${stopLoss}`);
  }
  return lines;
}

export function exitFormValues(automation: PaperCarryAutomation): {
  closeMaxDte: string;
  closeMinApr: string;
  takeProfit: string;
  stopLoss: string;
} {
  return {
    closeMaxDte: boundToInput(automation.closeMaxDte),
    closeMinApr: decimalToPercentInput(automation.closeMinNetApr),
    takeProfit: decimalToPercentInput(automation.takeProfitPct),
    stopLoss: decimalToPercentInput(
      automation.stopLossPct === null ? null : Math.abs(automation.stopLossPct),
    ),
  };
}

export function parseCarryExitForm(form: FormData): {
  closeMaxDte: number | null;
  closeMinNetApr: number | null;
  takeProfitPct: number | null;
  stopLossPct: number | null;
} | { error: string } {
  const takeProfitPct = parsePercent(form.get("takeProfit"));
  if (takeProfitPct !== null && takeProfitPct <= 0) {
    return { error: "Take profit % must be positive." };
  }
  const stopLossRaw = parsePercent(form.get("stopLoss"));
  return {
    closeMaxDte: parseBound(form.get("closeMaxDte")),
    closeMinNetApr: parsePercent(form.get("closeMinApr")),
    takeProfitPct,
    stopLossPct: stopLossRaw === null ? null : -Math.abs(stopLossRaw),
  };
}

export function parseTradeSource(value: unknown): TradeSource {
  return value === "engine" ? "engine" : "manual";
}

export function parseCloseReason(value: unknown): CloseReason | null {
  if (
    value === "dte" ||
    value === "mark_apr" ||
    value === "take_profit" ||
    value === "stop_loss"
  ) {
    return value;
  }
  return null;
}

export function formatSourceWord(source: TradeSource): string {
  return source === "engine" ? "Auto" : "Manual";
}

export function closedTradeLabel(
  entrySource: TradeSource,
  closeSource: TradeSource | null,
): string {
  return `In ${formatSourceWord(entrySource)} · Out ${formatSourceWord(closeSource ?? "manual")}`;
}

export function formatCloseHow(
  closeSource: TradeSource | null,
  reason: CloseReason | null,
): string {
  if (closeSource === "engine") {
    if (reason === "dte") {
      return "Closed automatically on DTE.";
    }
    if (reason === "mark_apr") {
      return "Closed automatically on mark APR.";
    }
    if (reason === "take_profit") {
      return "Closed automatically on take profit.";
    }
    if (reason === "stop_loss") {
      return "Closed automatically on stop loss.";
    }
    return "Closed automatically.";
  }
  return "Closed manually.";
}

function formatDteRange(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) {
    return `DTE ${min}–${max}`;
  }
  if (min !== null) {
    return `Min DTE ${min}`;
  }
  if (max !== null) {
    return `Max DTE ${max}`;
  }
  return null;
}

function formatPctPoints(value: number | null): string | null {
  if (value === null) {
    return null;
  }
  return `${Number((value * 100).toPrecision(12))}%`;
}

function parseBound(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "").trim();
  if (text === "") {
    return null;
  }
  const value = Number(text.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function parsePercent(raw: FormDataEntryValue | null): number | null {
  const value = parseBound(raw);
  return value === null ? null : value / 100;
}

function boundToInput(value: number | null): string {
  return value === null ? "" : String(value);
}

function decimalToPercentInput(value: number | null): string {
  if (value === null) {
    return "";
  }
  return String(Number((value * 100).toPrecision(12)));
}
