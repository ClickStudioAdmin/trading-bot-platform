import type {
  PaperEngineConfig,
  PaperEngineLayer,
  PaperSizeType,
} from "@/lib/engine/decide";
import { DEFAULT_PAPER_NOTIONAL_USDT, parseNotionalUsdt } from "@/lib/paper/open";
import { asNullableNumber, asNumber } from "@/lib/paper/rows";

export type PaperLayerFormValues = {
  key: string;
  id: string;
  sizeType: PaperSizeType;
  notionalUsdt: number;
  minApr: string;
  minDte: string;
  maxDte: string;
  minCapacity: string;
  minSize: string;
  maxOpenCount: string;
  maxOpenNotional: string;
  closeMaxDte: string;
  closeMinApr: string;
  takeProfit: string;
  stopLoss: string;
};

export type PaperRulesFormValues = {
  enabled: boolean;
  layers: PaperLayerFormValues[];
};

export function defaultPaperLayer(sortOrder = 0): PaperEngineLayer {
  return {
    id: null,
    sortOrder,
    sizeType: "fixed",
    notionalUsdt: DEFAULT_PAPER_NOTIONAL_USDT,
    minNetApr: null,
    minDte: null,
    maxDte: null,
    minCapacityUsdt: null,
    minSizeUsdt: null,
    maxOpenCount: null,
    maxOpenNotionalUsdt: null,
    closeMaxDte: null,
    closeMinNetApr: null,
    takeProfitPct: null,
    stopLossPct: null,
  };
}

export function defaultPaperConfig(): PaperEngineConfig {
  return {
    enabled: false,
    layers: [defaultPaperLayer(0)],
  };
}

export function paperConfigToFormValues(
  config: PaperEngineConfig,
): PaperRulesFormValues {
  const layers = config.layers.length > 0 ? config.layers : [defaultPaperLayer(0)];
  return {
    enabled: config.enabled,
    layers: layers.map((layer, index) => ({
      key: layer.id !== null ? `id-${layer.id}` : `new-${index}`,
      id: layer.id === null ? "" : String(layer.id),
      sizeType: layer.sizeType,
      notionalUsdt: layer.notionalUsdt,
      minApr: decimalToPercentInput(layer.minNetApr),
      minDte: boundToInput(layer.minDte),
      maxDte: boundToInput(layer.maxDte),
      minCapacity: boundToInput(layer.minCapacityUsdt),
      minSize: boundToInput(layer.minSizeUsdt),
      maxOpenCount: boundToInput(layer.maxOpenCount),
      maxOpenNotional: boundToInput(layer.maxOpenNotionalUsdt),
      closeMaxDte: boundToInput(layer.closeMaxDte),
      closeMinApr: decimalToPercentInput(layer.closeMinNetApr),
      takeProfit: decimalToPercentInput(layer.takeProfitPct),
      stopLoss: decimalToPercentInput(
        layer.stopLossPct === null ? null : Math.abs(layer.stopLossPct),
      ),
    })),
  };
}

export function parsePaperRulesForm(
  form: FormData,
): { ok: true; config: PaperEngineConfig } | { ok: false; error: string } {
  const count = Number(String(form.get("ruleCount") ?? "0"));
  if (!Number.isInteger(count) || count < 0) {
    return { ok: false, error: "Add at least one rule, or save with the list empty." };
  }

  const layers: PaperEngineLayer[] = [];
  for (let index = 0; index < count; index += 1) {
    const parsed = parseLayer(form, index);
    if (!parsed.ok) {
      return parsed;
    }
    layers.push(parsed.layer);
  }

  return {
    ok: true,
    config: {
      enabled: String(form.get("enabled") ?? "") === "on",
      layers,
    },
  };
}

export function parsePaperRulesRow(
  row: Record<string, unknown>,
  sortOrder: number,
): PaperEngineLayer {
  return {
    id: asNumber(row.id),
    sortOrder,
    sizeType: parseSizeType(row.size_type),
    notionalUsdt: asNumber(row.notional_usdt),
    minNetApr: asNullableNumber(row.min_net_apr),
    minDte: asNullableNumber(row.min_dte),
    maxDte: asNullableNumber(row.max_dte),
    minCapacityUsdt: asNullableNumber(row.min_capacity_usdt),
    minSizeUsdt: asNullableNumber(row.min_size_usdt),
    maxOpenCount: asNullableNumber(row.max_open_count),
    maxOpenNotionalUsdt: asNullableNumber(row.max_open_notional_usdt),
    closeMaxDte: asNullableNumber(row.close_max_dte),
    closeMinNetApr: asNullableNumber(row.close_min_net_apr),
    takeProfitPct: asNullableNumber(row.take_profit_pct),
    stopLossPct: asNullableNumber(row.stop_loss_pct),
  };
}

export function paperLayerToRow(
  userId: string,
  layer: PaperEngineLayer,
) {
  return {
    user_id: userId,
    sort_order: layer.sortOrder,
    size_type: layer.sizeType,
    notional_usdt: layer.notionalUsdt,
    min_net_apr: layer.minNetApr,
    min_dte: layer.minDte,
    max_dte: layer.maxDte,
    min_capacity_usdt: layer.minCapacityUsdt,
    min_size_usdt: layer.minSizeUsdt,
    max_open_count: layer.maxOpenCount,
    max_open_notional_usdt: layer.maxOpenNotionalUsdt,
    close_max_dte: layer.closeMaxDte,
    close_min_net_apr: layer.closeMinNetApr,
    take_profit_pct: layer.takeProfitPct,
    stop_loss_pct: layer.stopLossPct,
  };
}

function parseLayer(
  form: FormData,
  index: number,
): { ok: true; layer: PaperEngineLayer } | { ok: false; error: string } {
  const prefix = `r${index}_`;
  const notionalUsdt = parseNotionalUsdt(String(form.get(`${prefix}notionalUsdt`) ?? ""));
  if (notionalUsdt === null) {
    return { ok: false, error: `Rule ${index + 1}: enter a positive order size.` };
  }

  const minDte = parseBound(form.get(`${prefix}minDte`));
  const maxDte = parseBound(form.get(`${prefix}maxDte`));
  if (minDte !== null && maxDte !== null && minDte > maxDte) {
    return { ok: false, error: `Rule ${index + 1}: min DTE cannot be greater than max DTE.` };
  }

  const maxOpenCount = parseBound(form.get(`${prefix}maxOpenCount`));
  if (maxOpenCount !== null && (!Number.isInteger(maxOpenCount) || maxOpenCount <= 0)) {
    return { ok: false, error: `Rule ${index + 1}: max open trades must be a positive whole number.` };
  }

  const maxOpenNotionalUsdt = parseBound(form.get(`${prefix}maxOpenNotional`));
  if (maxOpenNotionalUsdt !== null && maxOpenNotionalUsdt <= 0) {
    return { ok: false, error: `Rule ${index + 1}: max position size must be positive.` };
  }

  const sizeType = parseSizeType(form.get(`${prefix}sizeType`));
  const minSizeUsdt =
    sizeType === "dynamic" ? parseBound(form.get(`${prefix}minSize`)) : null;
  if (minSizeUsdt !== null && minSizeUsdt <= 0) {
    return { ok: false, error: `Rule ${index + 1}: min size must be positive.` };
  }
  if (minSizeUsdt !== null && minSizeUsdt > notionalUsdt) {
    return { ok: false, error: `Rule ${index + 1}: min size cannot be greater than order size.` };
  }

  const takeProfitPct = parsePercent(form.get(`${prefix}takeProfit`));
  if (takeProfitPct !== null && takeProfitPct <= 0) {
    return { ok: false, error: `Rule ${index + 1}: take profit % must be positive.` };
  }

  const stopLossRaw = parsePercent(form.get(`${prefix}stopLoss`));
  const idRaw = String(form.get(`${prefix}id`) ?? "").trim();

  return {
    ok: true,
    layer: {
      id:
        idRaw === "" || !Number.isFinite(Number(idRaw)) ? null : Number(idRaw),
      sortOrder: index,
      sizeType,
      notionalUsdt,
      minNetApr: parsePercent(form.get(`${prefix}minApr`)),
      minDte,
      maxDte,
      minCapacityUsdt:
        sizeType === "fixed" ? parseBound(form.get(`${prefix}minCapacity`)) : null,
      minSizeUsdt,
      maxOpenCount,
      maxOpenNotionalUsdt,
      closeMaxDte: parseBound(form.get(`${prefix}closeMaxDte`)),
      closeMinNetApr: parsePercent(form.get(`${prefix}closeMinApr`)),
      takeProfitPct,
      stopLossPct: stopLossRaw === null ? null : -Math.abs(stopLossRaw),
    },
  };
}

export function parseSizeType(value: unknown): PaperSizeType {
  return value === "dynamic" ? "dynamic" : "fixed";
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
