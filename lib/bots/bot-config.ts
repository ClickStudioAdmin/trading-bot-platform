import { formatDcaFilterReason, type DcaFilterSpec } from "@/lib/dca/filters";
import { formatExitExpressionText } from "@/lib/dca/exit-stack";
import { perpsLegHasOwnExit } from "@/lib/futures/conditions";
import { dcaEntryStackForSide } from "@/lib/dca/entry-stack";
import {
  dcaArmTriggerForSide,
  dcaIndicatorStartForSide,
  dcaStartKindForSide,
  dcaIntervalParts,
  type DcaPlaybook,
} from "@/lib/dca/playbook";
import type { PaperLayerFormValues } from "@/lib/engine/rules";
import {
  formatIndicatorStartReason,
  formatPriceCrossReason,
  formatStrategyLeafReason,
} from "@/lib/bots/condition-copy";
import type { FuturesAutomationFormValues } from "@/lib/futures/automation";
import {
  confirmFromEntryStack,
  entryStackIsLegacy,
  resolveEntryStack,
} from "@/lib/strategy/expr";
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

function dcaEntryLines(playbook: DcaPlaybook, side: FuturesSide): BotConfigLine[] {
  const startKind = dcaStartKindForSide(playbook, side);
  const lines: BotConfigLine[] = [
    setting("Start", dcaStartLabel(startKind)),
  ];
  if (startKind === "price") {
    const trigger = dcaArmTriggerForSide(playbook, side);
    lines.push(
      setting(
        "Price",
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
  if (startKind === "indicator" || startKind === "trend") {
    const start = dcaIndicatorStartForSide(playbook, side);
    lines.push(
      setting(
        startKind === "trend" ? "Trend" : "Indicator",
        start ? formatIndicatorStartReason(start, side) : null,
      ),
    );
  }
  if (startKind === "webhook") {
    lines.push(setting("Webhook", "Signal webhook"));
  }
  const confirm =
    playbook.direction === "both" && side === "short"
      ? playbook.shortConfirm
      : playbook.confirm;
  const stack = dcaEntryStackForSide(playbook, side);
  if (entryStackIsLegacy(stack)) {
    lines.push(
      setting(
        "Secondary entry",
        filterText(confirmFromEntryStack(stack) ?? confirm, side),
      ),
    );
  } else {
    lines.push(
      setting(
        "Entry conditions",
        stack.leaves
          .map((leaf, index) => {
            const join = stack.joins[index] === "or" ? "or" : "and";
            return `${join} ${formatStrategyLeafReason(leaf, side)}`;
          })
          .join(", "),
      ),
    );
  }
  return lines;
}

function dcaEntrySections(playbook: DcaPlaybook): Array<BotConfigSection | null> {
  return dcaSides(playbook).map((side, index) => {
    const lines = dcaEntryLines(playbook, side);
    if (index === 0 && playbook.disarmTrigger) {
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
    return section(
      side === "short" ? "Short Entry Condition Builder" : "Long Entry Condition Builder",
      lines,
    );
  });
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
      playbook.stopLossPct == null && playbook.breakevenActivationPct == null
        ? null
        : joinParts([
            playbook.stopLossPct == null
              ? null
              : joinParts([
                  pct(playbook.stopLossPct),
                  basisLabel(playbook.stopLossBasis),
                ]),
            playbook.breakevenActivationPct == null
              ? null
              : `Move breakeven at ${pct(playbook.breakevenActivationPct)} · offset ${pct(playbook.breakevenOffsetPct) ?? "0%"}`,
          ]),
    ),
  ];
  return lines;
}

function dcaCustomExitLine(
  playbook: DcaPlaybook,
  side: FuturesSide,
): BotConfigLine {
  const ownShort = side === "short" && playbook.direction === "both";
  return setting(
    "Custom conditions",
    formatExitExpressionText({
      filter: ownShort
        ? playbook.shortExitHard
          ? null
          : playbook.shortExitIf
        : playbook.exitHard
          ? null
          : playbook.exitIf,
      signal: ownShort ? playbook.shortExitHard : playbook.exitHard,
      stack: ownShort ? playbook.shortExitStack : playbook.exitStack,
      side,
    }) || null,
  );
}

function dcaExitSections(
  playbook: DcaPlaybook,
): Array<BotConfigSection | null> {
  const classic = dcaExitLines(playbook);
  return dcaSides(playbook).map((side) =>
    section(
      side === "short"
        ? "Short Exit Condition Builder"
        : "Long Exit Condition Builder",
      [...classic, dcaCustomExitLine(playbook, side)],
    ),
  );
}

export function dcaBotConfig(playbook: DcaPlaybook): BotConfigSection[] {
  return sectionsOf([
    section("General", [
      setting("Contract", playbook.symbol),
      setting("Direction", dcaDirectionLabel(playbook.direction)),
    ]),
    ...dcaEntrySections(playbook),
    section("Position Sizing", dcaSizingLines(playbook)),
    ...dcaExitSections(playbook),
  ]);
}

function perpsDirectionLabel(rule: FuturesAutomationFormValues): string {
  if (rule.formAction === "close_long") return "Close long";
  if (rule.formAction === "close_short") return "Close short";
  if (rule.direction === "both") return "Both";
  if (rule.direction === "short" || rule.formAction === "sell") return "Short";
  return "Long";
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
  if (rule.direction === "both") return "long";
  return rule.formAction === "sell" ||
    rule.formAction === "close_short" ||
    rule.direction === "short"
    ? "short"
    : "long";
}

function perpsEntryLines(input: {
  closing: boolean;
  side: FuturesSide;
  entrySource: FuturesAutomationFormValues["entrySource"];
  triggerBy: FuturesAutomationFormValues["triggerBy"];
  triggerCompare: FuturesAutomationFormValues["triggerCompare"];
  triggerPrice: string;
  indicator: FuturesAutomationFormValues["indicator"];
  confirm: FuturesAutomationFormValues["confirm"];
  entryStack: FuturesAutomationFormValues["entryStack"];
}): BotConfigLine[] {
  const entry: BotConfigLine[] = [
    setting("Initial order trigger", perpsEntryLabel(input.entrySource)),
  ];
  if (input.entrySource === "price") {
    const price = Number(input.triggerPrice);
    entry.push(
      setting(
        "Price",
        Number.isFinite(price) && input.triggerPrice.trim()
          ? formatPriceCrossReason({
              source: input.triggerBy,
              compare: input.triggerCompare,
              level: price,
            })
          : null,
      ),
    );
  } else if (input.entrySource === "indicator" || input.entrySource === "trend") {
    entry.push(
      setting(
        input.entrySource === "trend" ? "Trend" : "Indicator",
        input.indicator
          ? formatIndicatorStartReason(input.indicator, input.side)
          : null,
      ),
    );
  } else {
    entry.push(setting("Webhook", "Signal webhook"));
  }
  if (!input.closing) {
    const stack = resolveEntryStack(input.entryStack, input.confirm);
    if (entryStackIsLegacy(stack)) {
      entry.push(
        setting(
          "Secondary entry",
          filterText(confirmFromEntryStack(stack) ?? input.confirm, input.side),
        ),
      );
    } else {
      entry.push(
        setting(
          "Entry conditions",
          stack.leaves
            .map((leaf, index) => {
              const join = stack.joins[index] === "or" ? "or" : "and";
              return `${join} ${formatStrategyLeafReason(leaf, input.side)}`;
            })
            .join(", "),
        ),
      );
    }
  }
  return entry;
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
  const entry = perpsEntryLines({
    closing,
    side,
    entrySource: rule.entrySource,
    triggerBy: rule.triggerBy,
    triggerCompare: rule.triggerCompare,
    triggerPrice: rule.triggerPrice,
    indicator: rule.indicator,
    confirm: rule.confirm,
    entryStack: rule.entryStack,
  });
  const shortEntry =
    rule.direction === "both" && rule.shortEntry
      ? perpsEntryLines({
          closing: false,
          side: "short",
          entrySource: rule.shortEntry.entrySource,
          triggerBy: rule.shortEntry.triggerBy,
          triggerCompare: rule.shortEntry.triggerCompare,
          triggerPrice: String(rule.shortEntry.triggerPrice),
          indicator: rule.shortEntry.indicator,
          confirm: rule.shortEntry.confirm,
          entryStack: rule.shortEntry.entryStack,
        })
      : null;

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

  const exitSides: FuturesSide[] = closing
    ? []
    : rule.direction === "both"
      ? ["long", "short"]
      : [side];
  const classicExits: BotConfigLine[] = [
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
      "Stop loss",
      perpsLevel(rule.tpsl?.stopLoss, rule.tpsl?.slKind) ||
      rule.breakevenActivationPct.trim()
        ? joinParts([
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
            rule.breakevenActivationPct.trim()
              ? `Move breakeven at ${rule.breakevenActivationPct.trim()}% · offset ${rule.breakevenOffsetPct.trim() || "0"}%`
              : null,
          ])
        : null,
    ),
  ];

  return sectionsOf([
    section("General", [
      setting("Contract", rule.symbol),
      setting("Direction", perpsDirectionLabel(rule)),
    ]),
    section(
      rule.direction === "both"
        ? "Long Entry Condition Builder"
        : side === "short"
          ? "Short Entry Condition Builder"
          : "Long Entry Condition Builder",
      entry,
    ),
    ...(shortEntry ? [section("Short Entry Condition Builder", shortEntry)] : []),
    section("Position Sizing", sizing),
    ...exitSides.map((exitSide) => {
      const ownShort = exitSide === "short" && rule.direction === "both";
      const short = ownShort && perpsLegHasOwnExit(rule.shortEntry) ? rule.shortEntry : null;
      return section(
        exitSide === "short"
          ? "Short Exit Condition Builder"
          : "Long Exit Condition Builder",
        [
          ...classicExits,
          setting(
            "Custom conditions",
            formatExitExpressionText({
              filter: ownShort
                ? short?.exitHard
                  ? null
                  : short?.exitIf
                : rule.exitHard
                  ? null
                  : rule.exitIf,
              signal: ownShort ? short?.exitHard : rule.exitHard,
              stack: ownShort ? short?.exitStack : rule.exitStack,
              side: exitSide,
            }) || null,
          ),
        ],
      );
    }),
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
