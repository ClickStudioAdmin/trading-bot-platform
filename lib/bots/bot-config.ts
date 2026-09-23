import { formatDcaFilterReason, type DcaFilterSpec } from "@/lib/dca/filters";
import {
  dcaArmTriggerForSide,
  dcaIndicatorStartForSide,
  dcaIntervalParts,
  type DcaPlaybook,
} from "@/lib/dca/playbook";
import type { PaperLayerFormValues } from "@/lib/engine/rules";
import {
  formatIndicatorStartReason,
  formatPriceCrossReason,
} from "@/lib/bots/condition-copy";
import type { FuturesAutomationFormValues } from "@/lib/futures/automation";
import type { FuturesSide } from "@/lib/futures/model";

export type BotConfigLine = {
  label: string;
  value: string;
};

export type BotConfigSection = {
  title: string;
  lines: BotConfigLine[];
};

function setting(label: string, value: string | null | undefined): BotConfigLine {
  const text = String(value ?? "").trim();
  return { label, value: text || "Off" };
}

function section(
  title: string,
  rows: Array<BotConfigLine | null>,
): BotConfigSection | null {
  const lines = rows.filter((row): row is BotConfigLine => row != null);
  return lines.length > 0 ? { title, lines } : null;
}

function sectionsOf(
  rows: Array<BotConfigSection | null>,
): BotConfigSection[] {
  return rows.filter((row): row is BotConfigSection => row != null);
}

function joinParts(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

function amount(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return String(value);
}

function pct(value: number | null | undefined): string | null {
  const text = amount(value);
  return text == null ? null : `${text}%`;
}

function orderLabel(value: string | null | undefined): string {
  return value === "limit" ? "Limit" : "Market";
}

function basisLabel(value: string | null | undefined): string {
  return value === "first_entry" ? "First fill" : "Average entry";
}

function filterText(
  spec: DcaFilterSpec | null | undefined,
  side: FuturesSide,
): string | null {
  return spec ? formatDcaFilterReason(spec, side) : null;
}

function dcaSides(playbook: DcaPlaybook): FuturesSide[] {
  if (playbook.direction === "both") {
    return ["long", "short"];
  }
  return [playbook.direction === "short" ? "short" : "long"];
}

function sidePrefix(playbook: DcaPlaybook, side: FuturesSide): string {
  if (playbook.direction !== "both") {
    return "";
  }
  return side === "short" ? "Short " : "Long ";
}

function dcaStartLabel(kind: string): string {
  if (kind === "price") return "Price";
  if (kind === "webhook") return "Signal";
  if (kind === "indicator") return "Indicator";
  if (kind === "trend") return "Trend";
  return "Immediate";
}

function dcaDirectionLabel(direction: string): string {
  if (direction === "short") return "Short";
  if (direction === "both") return "Both";
  return "Long";
}

function dcaMaxValueLabel(playbook: DcaPlaybook): string {
  const value = amount(playbook.maxValue);
  if (!value) {
    return "No max value";
  }
  if (playbook.maxValueKind === "percent") {
    return `${value}% of account`;
  }
  if (playbook.maxValueKind === "margin") {
    return `${value}% of available margin`;
  }
  return `${value} USDT`;
}

function dcaEntryLines(playbook: DcaPlaybook): BotConfigLine[] {
  const lines: BotConfigLine[] = [
    setting("Start", dcaStartLabel(playbook.startKind)),
  ];
  for (const side of dcaSides(playbook)) {
    const prefix = sidePrefix(playbook, side);
    if (playbook.startKind === "price") {
      const trigger = dcaArmTriggerForSide(playbook, side);
      lines.push(
        setting(
          `${prefix}Price`,
          trigger
            ? formatPriceCrossReason({
                source: trigger.triggerBy,
                compare: trigger.compare,
                level: trigger.price,
              })
            : null,
        ),
      );
    }
    if (playbook.startKind === "indicator" || playbook.startKind === "trend") {
      const start = dcaIndicatorStartForSide(playbook, side);
      lines.push(
        setting(
          `${prefix}${playbook.startKind === "trend" ? "Trend" : "Indicator"}`,
          start ? formatIndicatorStartReason(start, side) : null,
        ),
      );
    }
    if (playbook.startKind === "webhook" && side === dcaSides(playbook)[0]) {
      lines.push(setting("Webhook", "Signal webhook"));
    }
    const confirm =
      playbook.direction === "both" && side === "short"
        ? playbook.shortConfirm
        : playbook.confirm;
    lines.push(
      setting(`${prefix}Secondary entry`, filterText(confirm, side)),
    );
  }
  if (playbook.disarmTrigger) {
    lines.push(
      setting(
        "Disarm",
        formatPriceCrossReason({
          source: playbook.disarmTrigger.triggerBy,
          compare: playbook.disarmTrigger.compare,
          level: playbook.disarmTrigger.price,
        }),
      ),
    );
  }
  return lines;
}

function dcaSizingLines(playbook: DcaPlaybook): BotConfigLine[] {
  const interval =
    playbook.dipPct == null &&
    playbook.intervalMinutes != null &&
    playbook.intervalMinutes > 0;
  const atr = !interval && playbook.spacingKind === "atr";
  const sizeUnit = playbook.sizeUnit === "qty" ? "Token qty" : "USDT";
  const size = amount(playbook.clipSize);
  const lines: Array<BotConfigLine | null> = [
    setting(
      "Max orders",
      playbook.maxClips == null ? "No cap" : amount(playbook.maxClips),
    ),
    setting("Max value", dcaMaxValueLabel(playbook)),
    setting("Size unit", sizeUnit),
    setting("Order size", size ? `${size} ${sizeUnit === "USDT" ? "USDT" : "tokens"}` : null),
    setting(
      "Averaging",
      interval ? "Add on interval" : "Add on price deviation",
    ),
  ];
  if (interval) {
    const parts = dcaIntervalParts(playbook.intervalMinutes);
    lines.push(setting("Add every", `${parts.value} ${parts.unit}`));
  } else if (atr) {
    lines.push(setting("Spacing", "ATR"));
    lines.push(setting("ATR period", amount(playbook.atrPeriod)));
    lines.push(
      setting(
        "ATR spacing",
        amount(playbook.atrSpacingMult)
          ? `${amount(playbook.atrSpacingMult)}× ATR`
          : null,
      ),
    );
    lines.push(
      setting("Order", playbook.dcaMode === "order" ? "Limit" : "Market"),
    );
  } else {
    lines.push(setting("Spacing", "Percentage"));
    lines.push(setting("Price deviation", pct(playbook.dipPct)));
    lines.push(
      setting("Order", playbook.dcaMode === "order" ? "Limit" : "Market"),
    );
  }
  lines.push(setting("Order size multiplier", amount(playbook.sizeMultiplier)));
  lines.push(
    setting("Price deviation multiplier", amount(playbook.deviationMultiplier)),
  );
  return lines.filter((row): row is BotConfigLine => row != null);
}

function dcaExitLines(playbook: DcaPlaybook): BotConfigLine[] {
  const tpAtr = playbook.takeProfitKind === "atr";
  const tpOn = tpAtr
    ? playbook.takeProfitAtrMult != null
    : playbook.takeProfitPct != null;
  const trailOn =
    playbook.trailingTriggerPct != null || playbook.trailingPct != null;
  const lines: BotConfigLine[] = [
    setting(
      "Take profit",
      tpOn
        ? joinParts([
            tpAtr
              ? `${amount(playbook.takeProfitAtrMult) ?? ""}× ATR`
              : pct(playbook.takeProfitPct),
            tpAtr && amount(playbook.atrPeriod)
              ? `Period ${amount(playbook.atrPeriod)}`
              : null,
            basisLabel(playbook.takeProfitBasis),
            orderLabel(playbook.takeProfitOrderType),
          ])
        : null,
    ),
    setting(
      "Trailing stop",
      trailOn
        ? joinParts([
            pct(playbook.trailingTriggerPct)
              ? `Trigger ${pct(playbook.trailingTriggerPct)}`
              : null,
            pct(playbook.trailingPct)
              ? `Trail ${pct(playbook.trailingPct)}`
              : null,
          ])
        : null,
    ),
    setting(
      "Stop loss",
      playbook.stopLossPct == null
        ? null
        : joinParts([
            pct(playbook.stopLossPct),
            basisLabel(playbook.stopLossBasis),
          ]),
    ),
    setting(
      "Move breakeven",
      playbook.breakevenActivationPct == null
        ? null
        : joinParts([
            `At ${pct(playbook.breakevenActivationPct)}`,
            `Offset ${pct(playbook.breakevenOffsetPct) ?? "0%"}`,
          ]),
    ),
  ];
  for (const side of dcaSides(playbook)) {
    const prefix = sidePrefix(playbook, side);
    const spec =
      playbook.direction === "both" && side === "short"
        ? playbook.shortExitIf
        : playbook.exitIf;
    lines.push(setting(`${prefix}Hard exit`, filterText(spec, side)));
  }
  return lines;
}

export function dcaBotConfig(playbook: DcaPlaybook): BotConfigSection[] {
  return sectionsOf([
    section("General", [
      setting("Contract", playbook.symbol),
      setting("Direction", dcaDirectionLabel(playbook.direction)),
    ]),
    section("Entry Conditions", dcaEntryLines(playbook)),
    section("Position Sizing", dcaSizingLines(playbook)),
    section("Exit Conditions", dcaExitLines(playbook)),
  ]);
}

function perpsActionLabel(action: FuturesAutomationFormValues["formAction"]): string {
  if (action === "sell") return "Sell";
  if (action === "close_long") return "Close long";
  if (action === "close_short") return "Close short";
  return "Buy";
}

function perpsEntryLabel(source: FuturesAutomationFormValues["entrySource"]): string {
  if (source === "indicator") return "Indicator";
  if (source === "trend") return "Trend";
  if (source === "webhook") return "Signal webhook";
  return "Price cross";
}

function perpsClosing(rule: FuturesAutomationFormValues): boolean {
  return rule.formAction === "close_long" || rule.formAction === "close_short";
}

function perpsSide(rule: FuturesAutomationFormValues): FuturesSide {
  return rule.formAction === "sell" || rule.formAction === "close_short"
    ? "short"
    : "long";
}

function perpsLevel(
  value: number | null | undefined,
  kind: string | null | undefined,
): string | null {
  const text = amount(value);
  if (!text) {
    return null;
  }
  return kind === "percent" ? `${text}%` : text;
}

export function perpsBotConfig(
  rule: FuturesAutomationFormValues,
): BotConfigSection[] {
  const closing = perpsClosing(rule);
  const side = perpsSide(rule);
  const size = rule.size.trim();
  const unit = rule.sizeUnit === "usdt" ? "USDT" : "Token qty";
  const entry: BotConfigLine[] = [
    setting("Initial order trigger", perpsEntryLabel(rule.entrySource)),
  ];
  if (!closing) {
    entry.push(setting("Skip if open", rule.skipIfOpen ? "Yes" : "No"));
  }
  if (rule.entrySource === "price") {
    const price = Number(rule.triggerPrice);
    entry.push(
      setting(
        "Price",
        Number.isFinite(price) && rule.triggerPrice.trim()
          ? formatPriceCrossReason({
              source: rule.triggerBy,
              compare: rule.triggerCompare,
              level: price,
            })
          : null,
      ),
    );
  } else if (rule.entrySource === "indicator" || rule.entrySource === "trend") {
    entry.push(
      setting(
        rule.entrySource === "trend" ? "Trend" : "Indicator",
        rule.indicator
          ? formatIndicatorStartReason(rule.indicator, side)
          : null,
      ),
    );
  } else {
    entry.push(setting("Webhook", "Signal webhook"));
  }
  if (!closing) {
    entry.push(
      setting("Secondary entry", filterText(rule.confirm, side)),
    );
  }

  const sizing: Array<BotConfigLine | null> = [
    setting(
      closing ? "Qty to close" : "Size",
      closing && !size
        ? "All"
        : size
          ? `${size}${unit === "USDT" ? " USDT" : ""}`
          : null,
    ),
  ];
  if (!closing) {
    sizing.push(setting("Unit", unit));
  }
  sizing.push(setting("Order", orderLabel(rule.orderType)));
  if (rule.orderType === "limit") {
    sizing.push(setting("Limit price", rule.limitPrice.trim() || null));
  }

  const exits: BotConfigLine[] = closing
    ? []
    : [
        setting(
          "Take profit",
          perpsLevel(rule.tpsl?.takeProfit, rule.tpsl?.tpKind)
            ? joinParts([
                perpsLevel(rule.tpsl?.takeProfit, rule.tpsl?.tpKind),
                rule.tpsl?.tpTrigger === "mark"
                  ? "Mark"
                  : rule.tpsl?.tpTrigger === "index"
                    ? "Index"
                    : "Last",
                orderLabel(rule.tpsl?.tpOrderType),
                rule.tpsl?.tpOrderType === "limit"
                  ? amount(rule.tpsl.tpLimitPrice)
                  : null,
                rule.tpsl?.mode === "partial" && rule.tpsl.tpQty
                  ? `Partial ${amount(rule.tpsl.tpQty)}`
                  : null,
              ])
            : null,
        ),
        setting(
          "Stop loss",
          perpsLevel(rule.tpsl?.stopLoss, rule.tpsl?.slKind)
            ? joinParts([
                perpsLevel(rule.tpsl?.stopLoss, rule.tpsl?.slKind),
                rule.tpsl?.slTrigger === "mark"
                  ? "Mark"
                  : rule.tpsl?.slTrigger === "index"
                    ? "Index"
                    : "Last",
                orderLabel(rule.tpsl?.slOrderType),
                rule.tpsl?.slOrderType === "limit"
                  ? amount(rule.tpsl.slLimitPrice)
                  : null,
                rule.tpsl?.mode === "partial" && rule.tpsl.slQty
                  ? `Partial ${amount(rule.tpsl.slQty)}`
                  : null,
              ])
            : null,
        ),
        setting(
          "Trailing stop",
          rule.trailing
            ? joinParts([
                `Retracement ${amount(rule.trailing.distance)}`,
                rule.trailing.activePrice != null
                  ? `Activation ${amount(rule.trailing.activePrice)}`
                  : null,
              ])
            : null,
        ),
        setting(
          "Move breakeven",
          rule.breakevenActivationPct.trim()
            ? joinParts([
                `At ${rule.breakevenActivationPct.trim()}%`,
                `Offset ${rule.breakevenOffsetPct.trim() || "0"}%`,
              ])
            : null,
        ),
        setting("Hard exit", filterText(rule.exitIf, side)),
      ];

  return sectionsOf([
    section("General", [
      setting("Contract", rule.symbol),
      setting("Action", perpsActionLabel(rule.formAction)),
    ]),
    section("Entry Conditions", entry),
    section("Position Sizing", sizing),
    section("Exit Conditions", exits),
  ]);
}

function paperFilled(value: string, suffix = ""): string | null {
  const text = value.trim();
  return text ? `${text}${suffix}` : null;
}

function paperMoney(value: string): string | null {
  const text = value.trim();
  return text ? `${text} USDT` : null;
}

export function paperBotConfig(layer: PaperLayerFormValues): BotConfigSection[] {
  const dynamic = layer.sizeType === "dynamic";
  const exitDynamic = layer.exitSizeType !== "fixed";
  return sectionsOf([
    section("Entry Conditions", [
      setting("Min APR %", paperFilled(layer.minApr, "%")),
      setting("Min DTE", paperFilled(layer.minDte)),
      setting("Max DTE", paperFilled(layer.maxDte)),
    ]),
    section("Position Sizing", [
      setting("Max position size", paperMoney(layer.maxOpenNotional)),
      setting("Max pairs", paperFilled(layer.maxOpenCount)),
      setting(
        "Order type",
        dynamic ? "Dynamic (scale in)" : "Fixed",
      ),
      dynamic
        ? null
        : setting("Order size", paperMoney(String(layer.notionalUsdt))),
      dynamic
        ? null
        : setting("Min usable book", paperMoney(layer.minCapacity)),
      dynamic || exitDynamic
        ? setting("Min order size", paperMoney(layer.minSize))
        : null,
    ]),
    section("Exit Conditions", [
      setting("DTE ≤", paperFilled(layer.closeMaxDte)),
      setting("APR % below", paperFilled(layer.closeMinApr, "%")),
      setting(
        "Exit order type",
        layer.exitSizeType === "fixed"
          ? "Fixed (entire position)"
          : "Dynamic (scale out)",
      ),
      setting("Take profit", paperFilled(layer.takeProfit, "%")),
      setting("Stop loss", paperFilled(layer.stopLoss, "%")),
    ]),
  ]);
}
