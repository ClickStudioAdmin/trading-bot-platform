"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BacktestRecipeFields } from "@/components/backtest-recipe-fields";
import { BacktestOriginBadges } from "@/components/backtest-run-view";
import { DatePicker } from "@/components/date-picker";
import { FuturesSymbolSelect } from "@/components/futures-symbol-select";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { queueTemplateBacktestAction } from "@/lib/backtest/actions";
import type { BacktestRecipe } from "@/lib/backtest/model";
import {
  BACKTEST_COMPARABLE_CAP,
  BACKTEST_FEE_PRESETS,
  BACKTEST_LONG_TAPE_BARS,
  DEFAULT_LEVERAGE,
  DEFAULT_STARTING_USDT,
  backtestShouldRunInline,
  backtestTapeInterval,
  backtestWindowEndingToday,
  defaultBacktestDates,
  estimateBacktestBars,
  parseBacktestDates,
} from "@/lib/backtest/model";
import {
  canQueueUserBacktest,
  findMatchingBacktestDeskBot,
  findMatchingBacktestTemplate,
  formatBacktestDeskMatch,
  groupBacktestLibrary,
  type BacktestDeskBot,
  type BacktestLibraryFolder,
  type BacktestLibraryItem,
} from "@/lib/backtest/library";
import { findBacktestableTemplate } from "@/components/backtest-dialog";
import {
  DCA_INDICATOR_TIMEFRAME_LABELS,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import { formatGroupedNumberInput } from "@/lib/paper/open";

function withSymbol(options: LinearPerp[], symbol: string): LinearPerp[] {
  const needle = symbol.trim().toUpperCase();
  if (!needle || options.some((row) => row.symbol === needle)) {
    return options;
  }
  const base = needle.replace(/USDT$/, "").replace(/USDC$/, "") || needle;
  return [
    {
      symbol: needle,
      baseCoin: base,
      quoteCoin: needle.endsWith("USDC") ? "USDC" : "USDT",
      minQty: 0,
      maxQty: 0,
      maxMktQty: 0,
      minNotional: 0,
      minPrice: 0,
      tickSize: 0,
    },
    ...options,
  ];
}

export type BacktestQueueSeed = {
  recipe: BacktestRecipe;
  sourceTemplateId: string;
  fromDate: string;
  toDate: string;
  startingUsdt: number;
  leverage: number;
  interval: DcaIndicatorTimeframe;
  symbol: string;
  venue: string;
  venueEnvironment: string | null;
  comparables: string[];
};

export function BacktestQueueForm({
  templates,
  folders = [],
  deskBots = [],
  selectedTemplateId = "",
  draftId = "",
  seed = null,
  loadedFromRun = false,
  defaultVenue = "bybit",
  defaultVenueEnvironment = null,
}: {
  templates: BacktestLibraryItem[];
  folders?: BacktestLibraryFolder[];
  deskBots?: BacktestDeskBot[];
  selectedTemplateId?: string;
  draftId?: string;
  seed?: BacktestQueueSeed | null;
  loadedFromRun?: boolean;
  defaultVenue?: string;
  defaultVenueEnvironment?: string | null;
}) {
  const router = useRouter();
  const dates = defaultBacktestDates();
  const initialTemplate =
    templates.find((row) => row.id === selectedTemplateId) ?? null;
  const [templateId, setTemplateId] = useState(
    seed ? seed.sourceTemplateId : (initialTemplate?.id ?? ""),
  );
  const [recipe, setRecipe] = useState<BacktestRecipe | null>(
    seed?.recipe ?? initialTemplate?.recipe ?? null,
  );
  const [sourceTemplateId, setSourceTemplateId] = useState(
    seed ? seed.sourceTemplateId : (initialTemplate?.id ?? ""),
  );
  const [symbol, setSymbol] = useState(
    seed?.symbol ?? initialTemplate?.recipe.symbol ?? "",
  );
  const [comparables, setComparables] = useState<string[]>(
    seed?.comparables ?? [],
  );
  const [venue, setVenue] = useState(
    (seed?.venue ?? defaultVenue) === "hyperliquid" ? "hyperliquid" : "bybit",
  );
  const [fromDate, setFromDate] = useState(seed?.fromDate ?? dates.from);
  const [toDate, setToDate] = useState(seed?.toDate ?? dates.to);
  const [startingBalance, setStartingBalance] = useState(() =>
    formatGroupedNumberInput(
      String(seed?.startingUsdt ?? DEFAULT_STARTING_USDT),
      true,
    ),
  );
  const [leverage, setLeverage] = useState(() =>
    formatGroupedNumberInput(
      String(seed?.leverage ?? DEFAULT_LEVERAGE),
      true,
    ),
  );
  const [activeDraftId, setActiveDraftId] = useState(draftId);
  const [venueEnvironment, setVenueEnvironment] = useState(
    seed?.venueEnvironment ?? defaultVenueEnvironment,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipeFieldIssues, setRecipeFieldIssues] = useState<string[]>([]);
  const [bybitPairs, setBybitPairs] = useState<LinearPerp[]>([]);
  const [hyperliquidPairs, setHyperliquidPairs] = useState<LinearPerp[]>([]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ venue });
    if (venueEnvironment && venue === "hyperliquid") {
      params.set("env", venueEnvironment);
    }
    void fetch(`/api/market/perps?${params.toString()}`)
      .then(async (response) => {
        const body = (await response.json()) as { pairs?: LinearPerp[] };
        return body.pairs ?? [];
      })
      .then((rows) => {
        if (cancelled) {
          return;
        }
        if (venue === "hyperliquid") {
          setHyperliquidPairs(rows);
        } else {
          setBybitPairs(rows);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [venue, venueEnvironment]);

  const matchingTemplate = useMemo(
    () =>
      recipe
        ? findMatchingBacktestTemplate(recipe, templates, sourceTemplateId)
        : null,
    [recipe, sourceTemplateId, templates],
  );
  const matchingDeskBot = useMemo(
    () => (recipe ? findMatchingBacktestDeskBot(recipe, deskBots) : null),
    [deskBots, recipe],
  );
  const templateGroups = useMemo(
    () => groupBacktestLibrary(templates, folders),
    [folders, templates],
  );
  const editedAway = Boolean(
    recipe &&
      (sourceTemplateId || templateId || loadedFromRun) &&
      !matchingTemplate &&
      !matchingDeskBot,
  );
  const pairs = withSymbol(
    venue === "hyperliquid" ? hyperliquidPairs : bybitPairs,
    symbol,
  );
  const comparableOptions = pairs.filter((row) => row.symbol !== symbol);

  const preview = useMemo(() => {
    const range = parseBacktestDates(fromDate, toDate);
    if (!range.ok) {
      return {
        bars: 0,
        inline: false,
        interval: backtestTapeInterval(recipe, 0, 0),
        error: range.error,
      };
    }
    const interval = backtestTapeInterval(recipe, range.fromMs, range.toMs);
    const bars = estimateBacktestBars(range.fromMs, range.toMs, interval);
    return {
      bars,
      interval,
      inline: backtestShouldRunInline(bars, 1 + comparables.length),
      error: null as string | null,
    };
  }, [comparables.length, fromDate, recipe, toDate]);

  const pairChanged =
    recipe != null &&
    symbol.trim().toUpperCase() !== recipe.symbol.trim().toUpperCase();
  const queueAllowed = recipe
    ? canQueueUserBacktest(recipe)
    : { ok: false as const, error: "Load a bot or pick a template to backtest." };

  return (
    <section
      id="replay"
      className="mb-8 rounded-card border border-line bg-surface p-5"
    >
      <h2 className="text-lg font-semibold">New backtest</h2>
      <p className="mt-1 text-sm text-ink-muted">
        {loadedFromRun
          ? "Parameters loaded from the previous run. Tweak them and queue a new one."
          : "Pick a desk bot or a library template. Edit the replay fields, then queue. Long windows go to the engine worker."}
      </p>
      <div className="mt-4 grid items-start gap-6 lg:grid-cols-2">
      <form
        className="space-y-3"
        action={async (formData) => {
          setPending(true);
          setError(null);
          const result = await queueTemplateBacktestAction(formData);
          setPending(false);
          if (!result.ok) {
            setError(result.error ?? "Could not queue that backtest.");
            return;
          }
          router.push(
            result.runId
              ? `/account/backtests/${result.runId}`
              : "/account/backtests",
          );
          router.refresh();
        }}
      >
        {activeDraftId ? (
          <input type="hidden" name="draftId" value={activeDraftId} />
        ) : null}
        <input type="hidden" name="sourceTemplateId" value={sourceTemplateId} />
        {recipe ? (
          <input type="hidden" name="recipe" value={JSON.stringify(recipe)} />
        ) : null}
        <label className="block text-xs text-ink-muted">
          Bot
          <input
            type="hidden"
            name="templateId"
            value={
              templates.some((row) => row.id === templateId) ? templateId : ""
            }
          />
          <select
            value={templateId}
            onChange={(event) => {
              const value = event.target.value;
              const desk = deskBots.find((row) => row.id === value);
              const next = templates.find((row) => row.id === value);
              setTemplateId(value);
              if (desk) {
                const match = findBacktestableTemplate(desk.recipe, templates);
                setRecipe(desk.recipe);
                setSourceTemplateId(match?.id ?? "");
                setSymbol(desk.recipe.symbol);
                setVenue(
                  desk.venue === "hyperliquid" ? "hyperliquid" : "bybit",
                );
                setVenueEnvironment(desk.venueEnvironment);
                setComparables((rows) =>
                  rows.filter((row) => row !== desk.recipe.symbol),
                );
                setActiveDraftId("");
                return;
              }
              if (next) {
                setRecipe(next.recipe);
                setSourceTemplateId(next.id);
                setSymbol(next.recipe.symbol);
                setComparables((rows) =>
                  rows.filter((row) => row !== next.recipe.symbol),
                );
                setActiveDraftId("");
              }
            }}
            className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
          >
            <option value="">
              {loadedFromRun && recipe
                ? "Loaded from previous run"
                : recipe && !templateId
                  ? "Loaded from Automations"
                  : "Pick a desk bot or template"}
            </option>
            {deskBots.length > 0 ? (
              <optgroup label="Desk automations">
                {deskBots.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.recipe.kind === "dca" ? "DCA" : "Perps"} · {row.name} ·{" "}
                    {row.recipe.symbol} · {row.deskName}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {templateGroups.map((group) => (
              <optgroup key={group.id} label={group.label}>
                {group.items.map((row) => (
                  <option key={`${group.id}:${row.id}`} value={row.id}>
                    {row.recipe.kind === "dca" ? "DCA" : "Perps"} · {row.name} ·{" "}
                    {row.recipe.symbol}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DatePicker
              label="Start date"
              name="fromDate"
              value={fromDate}
              max={toDate}
              onChange={setFromDate}
            />
            <DatePicker
              label="End date"
              name="toDate"
              value={toDate}
              min={fromDate}
              max={dates.to}
              onChange={setToDate}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                { days: 30, label: "1 month" },
                { days: 365, label: "1 year" },
                { days: 1825, label: "5 years" },
                { days: 3650, label: "10 years" },
              ] as const
            ).map((row) => (
              <button
                key={row.days}
                type="button"
                onClick={() => {
                  const next = backtestWindowEndingToday(row.days);
                  setFromDate(next.from);
                  setToDate(next.to);
                }}
                className="rounded-control border border-line px-2 py-1 text-xs text-ink-muted hover:border-line-strong hover:text-ink"
              >
                {row.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            Any range the venue has. Long tapes queue to the engine worker.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-ink-muted">
            Initial account balance
            <GroupedNumberInput
              name="startingBalance"
              value={startingBalance}
              onChange={setStartingBalance}
              allowDecimal
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm tabular-nums text-ink"
            />
          </label>
          <label className="block text-xs text-ink-muted">
            Leverage
            <GroupedNumberInput
              name="leverage"
              value={leverage}
              onChange={setLeverage}
              allowDecimal
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm tabular-nums text-ink"
            />
            <span className="mt-1 block text-xs text-ink-faint">
              Cash gates on margin (position value ÷ this). Empty is 1×.
            </span>
          </label>
        </div>
        <label className="block text-xs text-ink-muted">
          Venue
          <select
            name="venue"
            value={venue}
            onChange={(event) => setVenue(event.target.value)}
            className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
          >
            <option value="bybit">Bybit</option>
            <option value="hyperliquid">Hyperliquid</option>
          </select>
        </label>
        <div>
          <p className="text-xs text-ink-muted">Primary pair</p>
          <div className="mt-1">
            <FuturesSymbolSelect
              options={pairs}
              value={symbol}
              onChange={(next) => {
                setSymbol(next);
                setComparables((rows) => rows.filter((row) => row !== next));
              }}
              name="symbol"
            />
          </div>
        </div>
        <fieldset>
          <legend className="text-xs text-ink-muted">
            Comparables ({comparables.length}/{BACKTEST_COMPARABLE_CAP})
          </legend>
          <p className="mt-1 text-xs text-ink-faint">
            Same bot and window on other pairs. Ranked next to the primary.
          </p>
          {comparables.map((row) => (
            <input key={row} type="hidden" name="comparable" value={row} />
          ))}
          <div className="mt-2 flex flex-wrap gap-2">
            {comparables.map((row) => (
              <button
                key={row}
                type="button"
                onClick={() =>
                  setComparables((current) =>
                    current.filter((item) => item !== row),
                  )
                }
                className="rounded-control border border-line bg-surface-raised px-2 py-1 text-xs text-ink hover:border-line-strong"
              >
                {row} ×
              </button>
            ))}
          </div>
          {comparables.length < BACKTEST_COMPARABLE_CAP ? (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-control border border-line bg-canvas px-2 py-2">
              {comparableOptions.slice(0, 40).map((row) => {
                const checked = comparables.includes(row.symbol);
                return (
                  <label
                    key={row.symbol}
                    className="flex items-center gap-2 py-0.5 text-sm text-ink"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setComparables((current) =>
                          current.includes(row.symbol)
                            ? current.filter((item) => item !== row.symbol)
                            : [...current, row.symbol],
                        );
                      }}
                    />
                    {row.baseCoin}-{row.quoteCoin}
                  </label>
                );
              })}
            </div>
          ) : null}
        </fieldset>
        {recipe ? (
          <p className="text-xs text-ink-muted">
            {recipe.kind === "dca"
              ? "DCA starts armed. Clips and percent exits decide on close."
              : "Entries fill at bar close. Stops use the adverse wick."}{" "}
            Fee: {BACKTEST_FEE_PRESETS.vip0_taker.label}.
          </p>
        ) : null}
        {preview.error ? (
          <p className="text-sm text-danger">{preview.error}</p>
        ) : (
          <p className="text-xs text-ink-muted">
            Replay tape {DCA_INDICATOR_TIMEFRAME_LABELS[preview.interval]}
            {recipe?.kind === "dca" && recipe.startKind === "indicator"
              ? " · bot indicator"
              : " · from this window"}
            . About {preview.bars.toLocaleString()} bars
            {comparables.length > 0
              ? ` × ${1 + comparables.length} pairs`
              : ""}
            .{" "}
            {preview.inline
              ? "This will run now."
              : preview.bars >= BACKTEST_LONG_TAPE_BARS
                ? "This will take a while and queue for the engine worker."
                : "This will queue for the engine worker."}
          </p>
        )}
        {venueEnvironment ? (
          <input
            type="hidden"
            name="venueEnvironment"
            value={venueEnvironment}
          />
        ) : null}
        <input type="hidden" name="feePreset" value="vip0_taker" />
        {recipe && !queueAllowed.ok ? (
          <p className="text-sm text-danger">{queueAllowed.error}</p>
        ) : null}
        {recipeFieldIssues.map((issue) => (
          <p key={issue} className="text-sm text-danger">
            {issue}
          </p>
        ))}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={
            pending ||
            Boolean(preview.error) ||
            !queueAllowed.ok ||
            recipeFieldIssues.length > 0
          }
          className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent disabled:opacity-50"
        >
          {pending
            ? preview.inline
              ? "Running…"
              : "Queuing…"
            : preview.inline
              ? "Run backtest"
              : "Queue backtest"}
        </button>
      </form>
      {recipe ? (
        <aside className="rounded-card border border-line bg-canvas p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Bot to replay</h3>
              <p className="mt-1 text-xs text-ink-muted">
                {loadedFromRun
                  ? "These are the recipe fields from that run. Edit any of them before you queue."
                  : "Change the replay fields here. Pair and dates on the left are the market window. The replay tape follows the bot."}
              </p>
            </div>
            <BacktestOriginBadges
              templateName={matchingTemplate?.name ?? null}
              deskLabel={
                matchingDeskBot
                  ? formatBacktestDeskMatch(matchingDeskBot)
                  : null
              }
              edited={editedAway}
            />
          </div>
          {pairChanged ? (
            <p className="mt-2 text-xs text-warning">
              Primary pair is {symbol}. The bot was saved on {recipe.symbol}.
            </p>
          ) : null}
          <div className="mt-4">
            <BacktestRecipeFields
              key={
                sourceTemplateId || draftId || (loadedFromRun ? "rerun" : "current")
              }
              recipe={recipe}
              onIssuesChange={setRecipeFieldIssues}
              onChange={setRecipe}
            />
          </div>
        </aside>
      ) : (
        <aside className="rounded-card border border-line bg-canvas p-4">
          <h3 className="text-sm font-semibold">Bot to replay</h3>
          <p className="mt-2 text-sm text-ink-muted">
            Pick a template, or open Backtest from a Perps or DCA bot on
            Automations.
          </p>
        </aside>
      )}
      </div>
    </section>
  );
}
