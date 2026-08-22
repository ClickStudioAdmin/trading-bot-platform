import type { PaperEngineRules } from "@/lib/engine/decide";
import { DEFAULT_PAPER_NOTIONAL_USDT, parseNotionalUsdt } from "@/lib/paper/open";
import { asNullableNumber, asNumber } from "@/lib/paper/rows";

export type PaperRulesFormValues = {
  enabled: boolean;
  notionalUsdt: number;
  minApr: string;
  minDte: string;
  maxDte: string;
  minCapacity: string;
  maxOpenCount: string;
  maxOpenNotional: string;
  closeMaxDte: string;
  closeMinApr: string;
  takeProfit: string;
  stopLoss: string;
};

export function defaultPaperRules(): PaperEngineRules {
  return {
    enabled: false,
    notionalUsdt: DEFAULT_PAPER_NOTIONAL_USDT,
    minNetApr: null,
    minDte: null,
    maxDte: null,
    minCapacityUsdt: null,
    maxOpenCount: null,
    maxOpenNotionalUsdt: null,
    closeMaxDte: null,
    closeMinNetApr: null,
    takeProfitPct: null,
    stopLossPct: null,
  };
}

export function paperRulesToFormValues(
  rules: PaperEngineRules,
): PaperRulesFormValues {
  return {
    enabled: rules.enabled,
    notionalUsdt: rules.notionalUsdt,
    minApr: decimalToPercentInput(rules.minNetApr),
    minDte: boundToInput(rules.minDte),
    maxDte: boundToInput(rules.maxDte),
    minCapacity: boundToInput(rules.minCapacityUsdt),
    maxOpenCount: boundToInput(rules.maxOpenCount),
    maxOpenNotional: boundToInput(rules.maxOpenNotionalUsdt),
    closeMaxDte: boundToInput(rules.closeMaxDte),
    closeMinApr: decimalToPercentInput(rules.closeMinNetApr),
    takeProfit: decimalToPercentInput(rules.takeProfitPct),
    stopLoss: decimalToPercentInput(
      rules.stopLossPct === null ? null : Math.abs(rules.stopLossPct),
    ),
  };
}

export function parsePaperRulesForm(
  form: FormData,
): { ok: true; rules: PaperEngineRules } | { ok: false; error: string } {
  const notionalUsdt = parseNotionalUsdt(String(form.get("notionalUsdt") ?? ""));
  if (notionalUsdt === null) {
    return { ok: false, error: "Enter a positive USDT notional." };
  }

  const minDte = parseBound(form.get("minDte"));
  const maxDte = parseBound(form.get("maxDte"));
  if (minDte !== null && maxDte !== null && minDte > maxDte) {
    return { ok: false, error: "Min DTE cannot be greater than max DTE." };
  }

  const maxOpenCount = parseBound(form.get("maxOpenCount"));
  if (maxOpenCount !== null && (!Number.isInteger(maxOpenCount) || maxOpenCount <= 0)) {
    return { ok: false, error: "Max open count must be a positive whole number." };
  }

  const maxOpenNotionalUsdt = parseBound(form.get("maxOpenNotional"));
  if (maxOpenNotionalUsdt !== null && maxOpenNotionalUsdt <= 0) {
    return { ok: false, error: "Max open notional must be positive." };
  }

  const takeProfitPct = parsePercent(form.get("takeProfit"));
  if (takeProfitPct !== null && takeProfitPct <= 0) {
    return { ok: false, error: "Take profit % must be positive." };
  }

  const stopLossRaw = parsePercent(form.get("stopLoss"));
  const stopLossPct = stopLossRaw === null ? null : -Math.abs(stopLossRaw);

  return {
    ok: true,
    rules: {
      enabled: String(form.get("enabled") ?? "") === "on",
      notionalUsdt,
      minNetApr: parsePercent(form.get("minApr")),
      minDte,
      maxDte,
      minCapacityUsdt: parseBound(form.get("minCapacity")),
      maxOpenCount,
      maxOpenNotionalUsdt,
      closeMaxDte: parseBound(form.get("closeMaxDte")),
      closeMinNetApr: parsePercent(form.get("closeMinApr")),
      takeProfitPct,
      stopLossPct,
    },
  };
}

export function parsePaperRulesRow(row: Record<string, unknown>): PaperEngineRules {
  return {
    enabled: Boolean(row.enabled),
    notionalUsdt: asNumber(row.notional_usdt),
    minNetApr: asNullableNumber(row.min_net_apr),
    minDte: asNullableNumber(row.min_dte),
    maxDte: asNullableNumber(row.max_dte),
    minCapacityUsdt: asNullableNumber(row.min_capacity_usdt),
    maxOpenCount: asNullableNumber(row.max_open_count),
    maxOpenNotionalUsdt: asNullableNumber(row.max_open_notional_usdt),
    closeMaxDte: asNullableNumber(row.close_max_dte),
    closeMinNetApr: asNullableNumber(row.close_min_net_apr),
    takeProfitPct: asNullableNumber(row.take_profit_pct),
    stopLossPct: asNullableNumber(row.stop_loss_pct),
  };
}

export function paperRulesToRow(userId: string, rules: PaperEngineRules) {
  return {
    user_id: userId,
    enabled: rules.enabled,
    notional_usdt: rules.notionalUsdt,
    min_net_apr: rules.minNetApr,
    min_dte: rules.minDte,
    max_dte: rules.maxDte,
    min_capacity_usdt: rules.minCapacityUsdt,
    max_open_count: rules.maxOpenCount,
    max_open_notional_usdt: rules.maxOpenNotionalUsdt,
    close_max_dte: rules.closeMaxDte,
    close_min_net_apr: rules.closeMinNetApr,
    take_profit_pct: rules.takeProfitPct,
    stop_loss_pct: rules.stopLossPct,
    updated_at: new Date().toISOString(),
  };
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
