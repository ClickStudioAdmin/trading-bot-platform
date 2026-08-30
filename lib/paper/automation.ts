import type {
  ExitReason,
  PaperEngineLayer,
  PaperSizeType,
} from "@/lib/engine/decide";

export type TradeSource = "manual" | "engine";
export type CloseReason = ExitReason;

export type PaperCarryAutomation = {
  entrySizeType: PaperSizeType | null;
  exitSizeType: PaperSizeType | null;
  entryMinNetApr: number | null;
  entryMinDte: number | null;
  entryMaxDte: number | null;
  entryMinCapacityUsdt: number | null;
  entryMinSizeUsdt: number | null;
  entryMaxOpenNotionalUsdt: number | null;
  closeMaxDte: number | null;
  closeMinNetApr: number | null;
  takeProfitPct: number | null;
  stopLossPct: number | null;
};

export const EMPTY_AUTOMATION: PaperCarryAutomation = {
  entrySizeType: null,
  exitSizeType: null,
  entryMinNetApr: null,
  entryMinDte: null,
  entryMaxDte: null,
  entryMinCapacityUsdt: null,
  entryMinSizeUsdt: null,
  entryMaxOpenNotionalUsdt: null,
  closeMaxDte: null,
  closeMinNetApr: null,
  takeProfitPct: null,
  stopLossPct: null,
};

export function automationFromLayer(
  layer: PaperEngineLayer,
): PaperCarryAutomation {
  return {
    entrySizeType: layer.sizeType,
    exitSizeType: layer.exitSizeType,
    entryMinNetApr: layer.minNetApr,
    entryMinDte: layer.minDte,
    entryMaxDte: layer.maxDte,
    entryMinCapacityUsdt: layer.minCapacityUsdt,
    entryMinSizeUsdt: layer.minSizeUsdt,
    entryMaxOpenNotionalUsdt: layer.maxOpenNotionalUsdt,
    closeMaxDte: layer.closeMaxDte,
    closeMinNetApr: layer.closeMinNetApr,
    takeProfitPct: layer.takeProfitPct,
    stopLossPct: layer.stopLossPct,
  };
}

export function automationInsertColumns(automation: PaperCarryAutomation) {
  return {
    entry_size_type: automation.entrySizeType,
    exit_size_type: automation.exitSizeType,
    entry_min_net_apr: automation.entryMinNetApr,
    entry_min_dte: automation.entryMinDte,
    entry_max_dte: automation.entryMaxDte,
    entry_min_capacity_usdt: automation.entryMinCapacityUsdt,
    entry_min_size_usdt: automation.entryMinSizeUsdt,
    entry_max_open_notional_usdt: automation.entryMaxOpenNotionalUsdt,
    close_max_dte: automation.closeMaxDte,
    close_min_net_apr: automation.closeMinNetApr,
    take_profit_pct: automation.takeProfitPct,
    stop_loss_pct: automation.stopLossPct,
  };
}

export function formatEntryTriggers(automation: PaperCarryAutomation): string[] {
  const lines: string[] = [];
  if (automation.entrySizeType === "dynamic") {
    lines.push("Order Type Dynamic (scale in)");
  }
  const minApr = formatPctPoints(automation.entryMinNetApr);
  if (minApr) {
    lines.push(`Min APR: ${minApr}`);
  }
  const dte = formatDteRange(automation.entryMinDte, automation.entryMaxDte);
  if (dte) {
    lines.push(dte);
  }
  if (automation.entryMaxOpenNotionalUsdt !== null) {
    lines.push(
      `Max Position Size: $${Math.round(automation.entryMaxOpenNotionalUsdt).toLocaleString("en-US")}`,
    );
  }
  if (automation.entrySizeType === "dynamic") {
    if (automation.entryMinSizeUsdt !== null) {
      lines.push(
        `Min Order Size: $${Math.round(automation.entryMinSizeUsdt).toLocaleString("en-US")}`,
      );
    }
  } else if (automation.entryMinCapacityUsdt !== null) {
    lines.push(
      `Min usable book: $${Math.round(automation.entryMinCapacityUsdt).toLocaleString("en-US")}`,
    );
  }
  return lines;
}

export function formatExitOrderType(
  automation: Pick<PaperCarryAutomation, "exitSizeType">,
): string | null {
  if (automation.exitSizeType === "dynamic") {
    return "Order Type Dynamic (scale out)";
  }
  if (automation.exitSizeType === "fixed") {
    return "Order Type Fixed (entire position)";
  }
  return null;
}

export function formatExitTriggers(automation: PaperCarryAutomation): string[] {
  const lines: string[] = [];
  const orderType = formatExitOrderType(automation);
  if (orderType) {
    lines.push(orderType);
  }
  if (automation.closeMaxDte !== null) {
    lines.push(`DTE ≤ ${automation.closeMaxDte}`);
  }
  const closeApr = formatPctPoints(automation.closeMinNetApr);
  if (closeApr) {
    lines.push(`APR below ${closeApr}`);
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

export function parseEntrySizeType(value: unknown): PaperSizeType | null {
  if (value === "dynamic" || value === "fixed") {
    return value;
  }
  return null;
}

export function parseTradeSource(value: unknown): TradeSource {
  return value === "engine" ? "engine" : "manual";
}

export function parseCloseReason(value: unknown): CloseReason | null {
  if (
    value === "dte" ||
    value === "mark_apr" ||
    value === "take_profit" ||
    value === "stop_loss" ||
    value === "unwind"
  ) {
    return value;
  }
  return null;
}

export function formatSourceWord(source: TradeSource): string {
  return source === "engine" ? "Auto" : "Manual";
}

export function formatTriggerWord(source: TradeSource | null): "Manual" | "System" {
  return source === "engine" ? "System" : "Manual";
}

export function closedTradeLabel(
  entrySource: TradeSource,
  closeSource: TradeSource | null,
): string {
  return `In ${formatTriggerWord(entrySource)} · Out ${formatTriggerWord(closeSource)}`;
}

export function formatCarryEntryWhy(
  entrySource: TradeSource,
  automation: PaperCarryAutomation,
): string {
  const method =
    entrySource === "engine" ||
    automation.entrySizeType === "dynamic" ||
    automation.entrySizeType === "fixed"
      ? "System"
      : "Manual";
  const parts = [
    `Trigger ${formatTriggerWord(entrySource)}`,
    `Entry ${method}`,
  ];
  if (automation.entrySizeType === "dynamic") {
    parts.push("Scale in");
  } else if (automation.entrySizeType === "fixed") {
    parts.push("Fixed");
  }
  return parts.join(" · ");
}

export function formatCarryCloseWhy(
  closeSource: TradeSource | null,
  closeReason: CloseReason | null,
  automation: PaperCarryAutomation,
): string {
  const trigger = formatTriggerWord(closeSource);
  const method =
    closeSource === "engine" ||
    automation.exitSizeType === "dynamic" ||
    automation.exitSizeType === "fixed"
      ? "System"
      : "Manual";
  const parts = [`Trigger ${trigger}`, `Exit ${method}`];
  if (
    closeReason === "unwind" ||
    automation.exitSizeType === "dynamic"
  ) {
    parts.push("Scale out");
  } else if (
    automation.exitSizeType === "fixed" ||
    closeReason === null
  ) {
    parts.push("Close remaining");
  }
  if (closeSource === "engine") {
    if (closeReason === "dte") {
      parts.push("DTE");
    } else if (closeReason === "mark_apr") {
      parts.push("Mark APR");
    } else if (closeReason === "take_profit") {
      parts.push("Take profit");
    } else if (closeReason === "stop_loss") {
      parts.push("Stop loss");
    }
  }
  return parts.join(" · ");
}

export function formatFiredExitLines(
  automation: PaperCarryAutomation,
  closeReason: CloseReason | null,
): string[] {
  if (closeReason === "dte" && automation.closeMaxDte !== null) {
    return [`DTE ≤ ${automation.closeMaxDte}`];
  }
  const closeApr = formatPctPoints(automation.closeMinNetApr);
  if (closeReason === "mark_apr" && closeApr) {
    return [`APR below ${closeApr}`];
  }
  const takeProfit = formatPctPoints(automation.takeProfitPct);
  if (closeReason === "take_profit" && takeProfit) {
    return [`Take profit ${takeProfit}`];
  }
  const stopLoss = formatPctPoints(
    automation.stopLossPct === null ? null : Math.abs(automation.stopLossPct),
  );
  if (closeReason === "stop_loss" && stopLoss) {
    return [`Stop loss ${stopLoss}`];
  }
  return [];
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
    if (reason === "unwind") {
      return "Unwound automatically.";
    }
    return "Closed automatically.";
  }
  if (reason === "unwind") {
    return "Unwound manually.";
  }
  return "Closed at market.";
}

function formatDteRange(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) {
    return `DTE: ${min}–${max}`;
  }
  if (min !== null) {
    return `Min DTE: ${min}`;
  }
  if (max !== null) {
    return `Max DTE: ${max}`;
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
