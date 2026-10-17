import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import { snapshotDcaRecipe, snapshotPerpsRecipe } from "@/lib/templates/recipe";
import {
  recipeParamSections,
  type ParamSection,
} from "@/lib/backtest/param-sections";

export type ConditionReviewSample = {
  title: string;
  detail: string;
  sections: ParamSection[];
};

function dcaSections(fields: Record<string, string>): ParamSection[] {
  const form = new FormData();
  form.set("name", "Review");
  form.set("symbol", "BTCUSDT");
  form.set("clipSize", "1");
  form.set("sizeUnit", "qty");
  form.set("takeProfitPct", "10");
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  const parsed = parseDcaPlaybookForm(form);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return recipeParamSections(snapshotDcaRecipe(parsed.config));
}

function entrySections(fields: Record<string, string>): ParamSection[] {
  return dcaSections(fields).filter((section) =>
    section.title.endsWith("Entry Conditions"),
  );
}

/** Shapes for the admin Condition list. The live parameter lists use this same layout. */
export function adminConditionReview(): ConditionReviewSample[] {
  const twoGroups = entrySections({
    direction: "short",
    startKind: "trend",
    indicatorKind: "supertrend",
    indicatorTimeframe: "15",
    indicatorCompare: "cross_lte",
    indicatorPeriod: "10",
    indicatorMultiplier: "3",
    entryCount: "2",
    entry0Join: "and",
    entry0Source: "indicator",
    entry0indicatorKind: "rsi",
    entry0indicatorTimeframe: "15",
    entry0indicatorCompare: "cross_gte",
    entry0indicatorPeriod: "14",
    entry0indicatorLevel: "70",
    entry1Join: "or",
    entry1Source: "indicator",
    entry1indicatorKind: "rsi",
    entry1indicatorTimeframe: "60",
    entry1indicatorCompare: "cross_lte",
    entry1indicatorPeriod: "14",
    entry1indicatorLevel: "30",
  });
  const oneGroup = entrySections({
    direction: "long",
    startKind: "price",
    armTriggerBy: "last",
    armCompare: "gte",
    armPrice: "100",
    entryCount: "1",
    entry0Join: "and",
    entry0Source: "indicator",
    entry0indicatorKind: "ema",
    entry0indicatorTimeframe: "60",
    entry0indicatorCompare: "gte",
    entry0indicatorPeriod: "21",
  });
  const customExit = dcaSections({
    direction: "short",
    startKind: "immediate",
    exitIfTrigger: "trend",
    exitIfKind: "supertrend",
    exitIfTimeframe: "15",
    exitIfCompare: "cross_lte",
    exitIfPeriod: "10",
    exitIfMultiplier: "3",
    exitIfStackCount: "2",
    exitIfStack0Join: "and",
    exitIfStack0Trigger: "indicator",
    exitIfStack0Kind: "rsi",
    exitIfStack0Timeframe: "60",
    exitIfStack0Compare: "cross_gte",
    exitIfStack0Period: "14",
    exitIfStack0Level: "70",
    exitIfStack1Join: "or",
    exitIfStack1Trigger: "price",
    exitIfStack1TriggerBy: "last",
    exitIfStack1TriggerCompare: "lte",
    exitIfStack1TriggerPrice: "100",
  }).filter((section) => section.title === "Short Exit Conditions");
  const perps = snapshotPerpsRecipe({
    name: "Flex groups",
    symbol: "ETHUSDT",
    action: "sell",
    closeSide: null,
    orderType: "market",
    sizeUnit: "qty",
    size: 1,
    limitPrice: null,
    entrySource: "price",
    triggerBy: "last",
    triggerCompare: "lte",
    triggerPrice: 90,
    skipIfOpen: true,
    tpsl: null,
    trailing: null,
    confirm: null,
    entryStack: {
      leaves: [
        {
          kind: "indicator",
          start: {
            kind: "rsi",
            timeframe: "15",
            compare: "cross_gte",
            level: 70,
            period: 14,
            slowPeriod: null,
          },
        },
      ],
      joins: ["or"],
    },
  });
  return [
    {
      title: "Two groups",
      detail:
        "Short entry. The trend is the first condition in Group 1. And stays in that group. Or opens Group 2.",
      sections: twoGroups,
    },
    {
      title: "One group",
      detail:
        "Long entry. And keeps the added indicator in Group 1 with the price cross.",
      sections: oneGroup,
    },
    {
      title: "Custom exit",
      detail:
        "Take profit stays a labelled block. Custom conditions use the same Group cards. And stays in Group 1. Or opens Group 2.",
      sections: customExit,
    },
    {
      title: "Flex Or group",
      detail:
        "Short Flex entry. Or opens Group 2. The price cross stays in Group 1.",
      sections: recipeParamSections(perps).filter(
        (section) => section.title === "Short Entry Conditions",
      ),
    },
  ];
}
