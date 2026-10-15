import {
  DCA_INDICATOR_TIMEFRAME_LABELS,
  formatDcaIndicatorStartLabel,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import { formatDcaFilterReason, type DcaFilterSpec } from "@/lib/dca/filters";
import {
  formatHardExitText,
  formatStrategyLeafReason,
} from "@/lib/bots/condition-copy";
import type { TemplateHardExitSignal } from "@/lib/dca/hard-exit";
import type { BacktestRecipe, ReplayEvent } from "./model";

export type EventParameter = { label: string; value: string };
export type EventParameterSection = {
  role: string;
  detail: string;
  params: EventParameter[];
};

function timeframeLabel(value: DcaIndicatorTimeframe | null | undefined): string {
  if (!value) {
    return "";
  }
  return DCA_INDICATOR_TIMEFRAME_LABELS[value] ?? value;
}

function indicatorSection(input: {
  role: string;
  kind: DcaIndicatorKind;
  compare: string | null;
  level: number | null;
  period: number | null;
  slowPeriod: number | null;
  multiplier: number | null;
  timeframe: DcaIndicatorTimeframe | null;
  side: "long" | "short";
  detail: string;
}): EventParameterSection {
  const when = formatDcaIndicatorStartLabel({
    kind: input.kind,
    compare: input.compare,
    level: input.level,
    period: input.period,
    slowPeriod: input.slowPeriod,
    multiplier: input.multiplier,
    timeframe: input.timeframe,
    side: input.side,
  });
  const params: EventParameter[] = [
    { label: "Indicator", value: when },
    { label: "Timeframe", value: timeframeLabel(input.timeframe) || "—" },
  ];
  if (input.period != null) {
    params.push({ label: "Period", value: String(input.period) });
  }
  if (input.slowPeriod != null) {
    params.push({ label: "Slow period", value: String(input.slowPeriod) });
  }
  if (input.multiplier != null) {
    params.push({ label: "Multiplier", value: String(input.multiplier) });
  }
  if (input.level != null) {
    params.push({ label: "Level", value: String(input.level) });
  }
  return { role: input.role, detail: input.detail, params };
}

function filterSection(
  role: string,
  spec: DcaFilterSpec,
  side: "long" | "short",
  detail: string,
): EventParameterSection {
  const params: EventParameter[] = [
    { label: "Condition", value: formatDcaFilterReason(spec, side) },
    { label: "Timeframe", value: timeframeLabel(spec.timeframe) || "—" },
  ];
  if (spec.period != null) {
    params.push({ label: "Period", value: String(spec.period) });
  }
  if (spec.multiplier != null) {
    params.push({ label: "Multiplier", value: String(spec.multiplier) });
  }
  if (spec.level != null) {
    params.push({ label: "Level", value: String(spec.level) });
  }
  return { role, detail, params };
}

function hardExitSection(
  role: string,
  spec: DcaFilterSpec | null | undefined,
  signal: TemplateHardExitSignal | null | undefined,
  side: "long" | "short",
  detail: string,
): EventParameterSection | null {
  if (signal?.trigger === "price" || signal?.trigger === "webhook") {
    return {
      role,
      detail,
      params: [
        {
          label: "Condition",
          value: formatHardExitText({
            signal:
              signal.trigger === "webhook"
                ? { trigger: "webhook", webhookId: "" }
                : signal,
            side,
          }),
        },
      ],
    };
  }
  if (!spec) {
    return null;
  }
  return filterSection(role, spec, side, detail);
}

function factDetail(event: ReplayEvent, role: string): string {
  return event.facts?.find((row) => row.role === role)?.detail ?? "";
}

export function eventParameterSections(
  recipe: BacktestRecipe,
  event: ReplayEvent,
): EventParameterSection[] {
  const sections: EventParameterSection[] = [];
  const side = event.side;
  const entry = event.reason === "entry";
  const hardExit = event.reason === "exit_if";
  if (recipe.kind === "dca") {
    if (
      entry &&
      (recipe.startKind === "indicator" || recipe.startKind === "trend") &&
      recipe.indicatorKind &&
      (side !== "short" ||
        (recipe.shortStartKind == null && !recipe.shortIndicatorKind))
    ) {
      sections.push(
        indicatorSection({
          role: "Entry",
          kind: recipe.indicatorKind,
          compare: recipe.indicatorCompare,
          level: recipe.indicatorLevel,
          period: recipe.indicatorPeriod ?? null,
          slowPeriod: recipe.indicatorSlowPeriod ?? null,
          multiplier: recipe.indicatorMultiplier ?? null,
          timeframe: recipe.indicatorTimeframe,
          side,
          detail: factDetail(event, "Entry"),
        }),
      );
    }
    const shortStartKind = recipe.shortStartKind ?? recipe.startKind;
    if (
      entry &&
      side === "short" &&
      recipe.shortIndicatorKind &&
      (shortStartKind === "indicator" || shortStartKind === "trend")
    ) {
      sections.push(
        indicatorSection({
          role: "Short entry",
          kind: recipe.shortIndicatorKind,
          compare: recipe.shortIndicatorCompare ?? null,
          level: recipe.shortIndicatorLevel ?? null,
          period: recipe.shortIndicatorPeriod ?? null,
          slowPeriod: recipe.shortIndicatorSlowPeriod ?? null,
          multiplier: recipe.shortIndicatorMultiplier ?? null,
          timeframe: recipe.shortIndicatorTimeframe ?? null,
          side,
          detail: factDetail(event, "Short entry"),
        }),
      );
    }
    if (entry && recipe.confirm && side === "long") {
      sections.push(
        filterSection(
          "Secondary entry",
          recipe.confirm,
          side,
          factDetail(event, "Secondary entry"),
        ),
      );
    }
    if (entry && recipe.shortConfirm && side === "short") {
      sections.push(
        filterSection(
          "Short secondary entry",
          recipe.shortConfirm,
          side,
          factDetail(event, "Short secondary entry"),
        ),
      );
    }
    if (entry && recipe.confirm && side === "short" && !recipe.shortConfirm) {
      sections.push(
        filterSection(
          "Secondary entry",
          recipe.confirm,
          side,
          factDetail(event, "Secondary entry"),
        ),
      );
    }
    const dcaStack =
      side === "short" && recipe.direction === "both"
        ? recipe.shortEntryStack
        : recipe.entryStack;
    if (entry && dcaStack) {
      for (const leaf of dcaStack.leaves) {
        if (leaf.kind === "filter") {
          sections.push(
            filterSection(
              "Entry condition",
              leaf.spec,
              side,
              factDetail(event, "Entry condition"),
            ),
          );
          continue;
        }
        if (leaf.kind === "indicator" || leaf.kind === "trend") {
          sections.push(
            indicatorSection({
              role: "Entry condition",
              kind: leaf.start.kind,
              compare: leaf.start.compare,
              level: leaf.start.level,
              period: leaf.start.period,
              slowPeriod: leaf.start.slowPeriod,
              multiplier: leaf.start.multiplier ?? null,
              timeframe: leaf.start.timeframe,
              side,
              detail: factDetail(event, "Entry condition"),
            }),
          );
        }
      }
    }
    if (hardExit) {
      const longExit = hardExitSection(
        "Hard exit",
        recipe.exitIf,
        recipe.exitHard,
        side,
        factDetail(event, "Hard exit"),
      );
      if (longExit) {
        sections.push(longExit);
      }
      if (side === "short") {
        const shortExit = hardExitSection(
          "Short hard exit",
          recipe.shortExitIf,
          recipe.shortExitHard,
          side,
          factDetail(event, "Short hard exit"),
        );
        if (shortExit) {
          sections.push(shortExit);
        }
      }
    }
  } else {
    const shortLeg =
      side === "short" && recipe.direction === "both" ? recipe.shortEntry : null;
    const start = shortLeg ? shortLeg.indicator : recipe.indicator;
    const entrySource = shortLeg ? shortLeg.entrySource : recipe.entrySource;
    const confirm = shortLeg ? shortLeg.confirm : recipe.confirm;
    const entryStack = shortLeg ? shortLeg.entryStack : recipe.entryStack;
    if (
      entry &&
      start &&
      (entrySource === "indicator" || entrySource === "trend")
    ) {
      sections.push(
        indicatorSection({
          role: "Entry",
          kind: start.kind,
          compare: start.compare,
          level: start.level,
          period: start.period,
          slowPeriod: start.slowPeriod,
          multiplier: start.multiplier ?? null,
          timeframe: start.timeframe,
          side,
          detail: factDetail(event, "Entry"),
        }),
      );
    }
    if (entry && confirm) {
      sections.push(
        filterSection(
          "Secondary entry",
          confirm,
          side,
          factDetail(event, "Secondary entry"),
        ),
      );
    }
    if (entry && entryStack && !confirm) {
      for (const leaf of entryStack.leaves) {
        if (leaf.kind === "filter") {
          sections.push(
            filterSection(
              "Entry condition",
              leaf.spec,
              side,
              factDetail(event, "Entry condition"),
            ),
          );
          continue;
        }
        if (leaf.kind === "indicator" || leaf.kind === "trend") {
          sections.push(
            indicatorSection({
              role: "Entry condition",
              kind: leaf.start.kind,
              compare: leaf.start.compare,
              level: leaf.start.level,
              period: leaf.start.period,
              slowPeriod: leaf.start.slowPeriod,
              multiplier: leaf.start.multiplier ?? null,
              timeframe: leaf.start.timeframe,
              side,
              detail: factDetail(event, "Entry condition"),
            }),
          );
          continue;
        }
        sections.push({
          role: "Entry condition",
          detail: factDetail(event, "Entry condition"),
          params: [
            {
              label: "Condition",
              value: formatStrategyLeafReason(leaf, side),
            },
          ],
        });
      }
    }
    if (hardExit) {
      const exit = hardExitSection(
        "Hard exit",
        recipe.exitIf,
        recipe.exitHard,
        side,
        factDetail(event, "Hard exit"),
      );
      if (exit) {
        sections.push(exit);
      }
    }
  }
  if (sections.length === 0) {
    sections.push({
      role: "Fill",
      detail: "",
      params: [
        { label: "Side", value: side },
        { label: "Reason", value: event.reason },
      ],
    });
  }
  return sections;
}
