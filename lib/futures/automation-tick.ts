import {
  decideFuturesAutomationTick,
  futuresAutomationIdempotencyKey,
  parseFuturesAutomationRow,
  type FuturesAutomationRule,
} from "./automation";
import {
  emptyBarsByTimeframe,
  futuresAutomationNeedsBars,
  futuresAutomationNeedsWideBars,
  futuresAutomationTimeframes,
  futuresBreakevenDue,
  futuresBreakevenStop,
  futuresEntryConditionMet,
  futuresFilterMet,
  perpsExitForSide,
} from "./conditions";
import {
  addStackMatchesWebhook,
  entryStackListensOnPriceTick,
  entryStackMatchesWebhook,
} from "@/lib/strategy/expr";
import {
  describeExitBook,
  emptyExitRuntime,
  exitBookForClassic,
  exitClaimsCover,
  exitRuntimeFromJson,
  sideExitActions,
  type ExitBookSnapshot,
} from "@/lib/strategy/exit-actions";
import {
  applyPaperExitClaims,
  decideOpenExit,
  saveExitRuntime,
} from "@/lib/strategy/exit-desk";
import { hardExitMet } from "@/lib/dca/hard-exit";
import {
  exitExpressionMet,
  formatExitExpressionText,
} from "@/lib/dca/exit-stack";
import {
  perpsAutomationLegs,
  perpsRuleMatchesWebhook,
} from "./automation";
import {
  isBybitAgreementQuiet,
  isBybitAgreementReject,
} from "@/lib/exchanges/agreement";
import { runFuturesCommand } from "./command";
import { parseFuturesPositionRow, type FuturesPosition, type FuturesSide } from "./model";
import { FUTURES_LIVE_POSITION_STATUSES } from "./pending-close";
import {
  fetchBybitTickers,
  type BybitTicker,
} from "@/lib/exchanges/bybit/client";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { breakevenStopTpsl, triggerPrice, tickerTriggerPrices, tpslFromRow } from "./tpsl";
import {
  deskAllowsPerpsRecipes,
  parseDeskQuery,
  parseDeskType,
  type TradingAccountMode,
} from "@/lib/accounts/model";
import {
  parseStoredVenueEnvironment,
  parseStoredVenueId,
} from "@/lib/exchanges/venues";
import { loadDeskTickerMap } from "@/lib/market/desk-tickers";
import { loadDeskIndicatorBars } from "@/lib/market/desk-klines";
import {
  DCA_INDICATOR_TIMEFRAMES,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import type { CandleBar } from "@/lib/market/candles";
import {
  formatBreakevenReason,
  formatFuturesEntryReasons,
  futuresAddedMessage,
  futuresBreakevenMessage,
  futuresFiredMessage,
  futuresHardExitMessage,
} from "@/lib/bots/condition-copy";
import {
  flexAddDecision,
  flexAddLatchColumn,
  flexAddRetraceColumn,
} from "@/lib/futures/flex-add";
import { addStackGroups, type AddGroupOrder } from "@/lib/strategy/expr";
import {
  commitPositionRetraceFire,
  positionRetraceConsumed,
  positionRetraceToJson,
  resumePositionRetrace,
  type PositionRetraceMemory,
} from "@/lib/strategy/retrace";

type DeskAccount = {
  userId: string;
  mode: TradingAccountMode;
  deskType: ReturnType<typeof parseDeskType>;
  copyOfAccountId: string | null;
  venue: ReturnType<typeof parseStoredVenueId>;
  venueEnvironment: ReturnType<typeof parseStoredVenueEnvironment>;
};

export async function runFuturesAutomationTick(input?: {
  accountId?: string;
  tickers?: Map<string, BybitTicker>;
}): Promise<{ fired: number }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { fired: 0 };
  }
  let rulesQuery = supabase
    .from("futures_automation_rules")
    .select("*")
    .neq("mode", "disabled")
    .order("sort_order", { ascending: true });
  if (input?.accountId) {
    rulesQuery = rulesQuery.eq("account_id", input.accountId);
  }
  const { data: ruleRows, error: ruleError } = await rulesQuery;
  if (ruleError || !ruleRows || ruleRows.length === 0) {
    return { fired: 0 };
  }
  const uniqueAccountIds = [
    ...new Set(
      ruleRows.map((row) => String((row as { account_id: string }).account_id)),
    ),
  ];

  const [
    { data: accountRows },
    { data: openRows },
    fetchedTickers,
  ] = await Promise.all([
    supabase
      .from("trading_accounts")
      .select("id, user_id, mode, desk_type, venue, venue_environment, copy_of_account_id")
      .in("id", uniqueAccountIds),
    supabase
      .from("futures_positions")
      .select("*")
      .in("status", [...FUTURES_LIVE_POSITION_STATUSES])
      .in("account_id", uniqueAccountIds),
    input?.tickers
      ? Promise.resolve(input.tickers)
      : fetchBybitTickers("linear").catch(() => new Map<string, BybitTicker>()),
  ]);
  const tickers = fetchedTickers;

  const accounts = new Map(
    (accountRows ?? []).map((row) => {
      const venue = parseStoredVenueId((row as { venue?: unknown }).venue);
      return [
        String((row as { id: string }).id),
        {
          userId: String((row as { user_id: string }).user_id),
          mode: String((row as { mode: string }).mode) as TradingAccountMode,
          deskType: parseDeskType((row as { desk_type?: unknown }).desk_type),
          copyOfAccountId: parseDeskQuery(
            (row as { copy_of_account_id?: unknown }).copy_of_account_id,
          ),
          venue,
          venueEnvironment: parseStoredVenueEnvironment(
            venue,
            (row as { venue_environment?: unknown }).venue_environment,
          ),
        },
      ] as const;
    }),
  );
  const opens = (openRows ?? []).map((row) =>
    parseFuturesPositionRow(row as Record<string, unknown>),
  );
  const opensByAccount = new Map<string, FuturesPosition[]>();
  for (const row of opens) {
    const list = opensByAccount.get(row.accountId) ?? [];
    list.push(row);
    opensByAccount.set(row.accountId, list);
  }
  const savedBooks = savedExitBooks(openRows ?? []);

  const deskTickerCache = new Map<string, Map<string, BybitTicker>>();
  const klineCache = new Map<string, CandleBar[]>();
  const parsedRules: {
    rawAccountId: string;
    rule: FuturesAutomationRule;
    account: DeskAccount;
  }[] = [];

  let fired = 0;
  for (const raw of ruleRows) {
    const accountId = String((raw as { account_id: string }).account_id);
    const account = accounts.get(accountId);
    const rule = parseFuturesAutomationRow(
      raw as Record<string, unknown>,
      account?.venue,
    );
    if (!account || !rule.id || !deskAllowsPerpsRecipes(account)) {
      continue;
    }
    parsedRules.push({ rawAccountId: accountId, rule, account });
    const legs = perpsAutomationLegs(rule);
    const priceLegs = legs.filter((leg) =>
      entryStackListensOnPriceTick(leg.rule.entrySource, leg.rule.entryStack),
    );
    const addOnlyLegs = legs.filter(
      (leg) =>
        !priceLegs.some((row) => row.side === leg.side) &&
        (leg.rule.addStack?.leaves.length ?? 0) > 0,
    );
    if (priceLegs.length === 0 && addOnlyLegs.length === 0) {
      continue;
    }
    let deskTickers = tickers;
    if (account.venue === "hyperliquid" && !input?.tickers) {
      const cacheKey = `${account.venue}:${account.venueEnvironment ?? ""}`;
      if (!deskTickerCache.has(cacheKey)) {
        deskTickerCache.set(
          cacheKey,
          (await loadDeskTickerMap(
            account.venue,
            account.venueEnvironment,
          ).catch(() => new Map())) as Map<string, BybitTicker>,
        );
      }
      deskTickers = deskTickerCache.get(cacheKey) ?? tickers;
    }
    const ticker = deskTickers.get(rule.symbol);
    const prices = ticker ? tickerTriggerPrices(ticker) : null;
    const barsByTimeframe = await loadRuleBars({
      rule,
      account,
      cache: klineCache,
    });
    const bookOpens = opensByAccount.get(accountId) ?? [];
    let stopLegs = false;
    for (const leg of priceLegs) {
      if (stopLegs) {
        break;
      }
      const legRule = leg.rule;
      const price = prices ? triggerPrice(legRule.triggerBy, prices) : null;
      const side = leg.side;
      const openOnSide = bookOpens.find(
        (row) => row.symbol === rule.symbol && row.side === side,
      );
      const decision = decideFuturesAutomationTick({
        conditionMet: futuresEntryConditionMet({
          rule: legRule,
          side,
          price,
          prices,
          barsByTimeframe,
          firedWebhookId: legRule.entrySource === "webhook" ? null : undefined,
        }),
        wasTrue: legRule.conditionTrue,
        action: legRule.action,
        mode: rule.mode,
        bookReduceOnly: false,
        skipIfOpen: legRule.skipIfOpen,
        hasOpenOnSide: Boolean(openOnSide),
      });
      if (decision.fire) {
        const reasons = formatFuturesEntryReasons({
          entrySource: legRule.entrySource,
          side,
          triggerBy: legRule.triggerBy,
          triggerCompare: legRule.triggerCompare,
          triggerPrice: legRule.triggerPrice,
          price,
          indicator: legRule.indicator,
          confirm: legRule.confirm,
          entryStack: legRule.entryStack,
          retrace: legRule.retrace,
        });
        const result = await fireAutomationRule({
          rule: legRule,
          accountId,
          userId: account.userId,
          mode: account.mode,
          positionId: openOnSide?.id ?? null,
          reason: reasons,
        });
        if (!result.ok) {
          if (
            isBybitAgreementQuiet(result.error) ||
            isBybitAgreementReject(result.error)
          ) {
            if (!openOnSide) {
              await patchRule(supabase, rule.id, { mode: "disabled" });
              stopLegs = true;
            }
            if (isBybitAgreementQuiet(result.error)) {
              continue;
            }
          }
          await writeEventLog({
            level: "warning",
            scope: "trade",
            event: "engine.open_failed",
            message: reasons
              ? `${result.error} Trying: ${reasons}.`
              : result.error,
            userId: account.userId,
            accountId,
            strategy: FUTURES_STRATEGY_ID,
            data: {
              ruleId: rule.id,
              ruleName: rule.name,
              symbol: rule.symbol,
              side,
              action: legRule.action,
              positionId: openOnSide?.id ?? null,
              reason: reasons,
            },
          });
          continue;
        }
        fired += 1;
        await writeEventLog({
          scope: "trade",
          event: "engine.fired",
          message: futuresFiredMessage({
            name: rule.name,
            symbol: rule.symbol,
            action: legRule.action,
            closeSide: legRule.closeSide,
            reasons,
          }),
          userId: account.userId,
          accountId,
          strategy: FUTURES_STRATEGY_ID,
          data: {
            ruleId: rule.id,
            ruleName: rule.name,
            symbol: rule.symbol,
            side,
            action: legRule.action,
            positionId: result.positionId,
            entrySource: legRule.entrySource,
            reason: reasons,
          },
        });
        const addMemory = openOnSide
          ? retraceForOpen({
              stored: legRule.addRetrace,
              open: openOnSide,
              prices,
              barsByTimeframe,
            })
          : null;
        const addNow = flexAddDecision({
          stack: legRule.addStack,
          side,
          price,
          prices,
          barsByTimeframe,
          wasTrue: false,
          open: true,
          protection: openOnSide
            ? {
                openQty: openOnSide.qty,
                ...flexAddCoverage({
                  open: openOnSide,
                  rule,
                  prices,
                  savedBook: savedBooks.get(openOnSide.id) ?? null,
                }),
              }
            : null,
          positionRetrace:
            addMemory && openOnSide
              ? { average: openOnSide.entryPrice, memory: addMemory }
              : null,
        });
        await patchRule(supabase, rule.id, {
          [leg.latch]: true,
          [flexAddLatchColumn(leg.latch)]: addNow.met,
          ...(addMemory
            ? {
                [flexAddRetraceColumn(leg.latch)]:
                  positionRetraceToJson(addMemory),
              }
            : {}),
          last_fired_at: new Date().toISOString(),
        });
        continue;
      }
      if (decision.nextTrue !== legRule.conditionTrue) {
        await patchRule(supabase, rule.id, {
          [leg.latch]: decision.nextTrue,
        });
      }
      const added = await placeFlexAdd({
        supabase,
        rule,
        legRule,
        latch: leg.latch,
        side,
        accountId,
        userId: account.userId,
        mode: account.mode,
        open: openOnSide ?? null,
        price,
        prices,
        barsByTimeframe,
        savedBook: openOnSide ? (savedBooks.get(openOnSide.id) ?? null) : null,
      });
      fired += added;
    }
    if (!stopLegs) {
      for (const leg of addOnlyLegs) {
        const legRule = leg.rule;
        const price = prices ? triggerPrice(legRule.triggerBy, prices) : null;
        const openOnSide = bookOpens.find(
          (row) => row.symbol === rule.symbol && row.side === leg.side,
        );
        const added = await placeFlexAdd({
          supabase,
          rule,
          legRule,
          latch: leg.latch,
          side: leg.side,
          accountId,
          userId: account.userId,
          mode: account.mode,
          open: openOnSide ?? null,
          price,
          prices,
          barsByTimeframe,
          savedBook: openOnSide ? (savedBooks.get(openOnSide.id) ?? null) : null,
        });
        fired += added;
      }
    }
  }

  const { data: latestOpenRows } = await supabase
    .from("futures_positions")
    .select("*")
    .in("status", [...FUTURES_LIVE_POSITION_STATUSES])
    .in("account_id", uniqueAccountIds);
  const latestOpens = (latestOpenRows ?? []).map((row) =>
    parseFuturesPositionRow(row as Record<string, unknown>),
  );
  await monitorOwnedFuturesPositions({
    opens: latestOpens,
    rules: parsedRules,
    tickers,
    deskTickerCache,
    klineCache,
    providedTickers: Boolean(input?.tickers),
  });

  return { fired };
}

export async function fireWebhookAutomationEntries(input: {
  webhookId: string;
  accountId: string;
  userId: string;
  mode: TradingAccountMode;
}): Promise<{ fired: number }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { fired: 0 };
  }
  const { data: ruleRows } = await supabase
    .from("futures_automation_rules")
    .select("*")
    .eq("account_id", input.accountId)
    .neq("mode", "disabled")
    .order("sort_order", { ascending: true });
  const matchedRows = (ruleRows ?? []).filter((raw) => {
    const rule = parseFuturesAutomationRow(raw as Record<string, unknown>);
    return perpsRuleMatchesWebhook(rule, input.webhookId);
  });
  if (matchedRows.length === 0) {
    return { fired: 0 };
  }
  const [{ data: openRows }, { data: accountRow }] =
    await Promise.all([
      supabase
        .from("futures_positions")
        .select("*")
        .in("status", [...FUTURES_LIVE_POSITION_STATUSES])
        .eq("account_id", input.accountId),
      supabase
        .from("trading_accounts")
        .select("venue, venue_environment")
        .eq("id", input.accountId)
        .maybeSingle(),
    ]);
  const bookReduceOnly = false;
  const venue = parseStoredVenueId(
    (accountRow as { venue?: unknown } | null)?.venue,
  );
  const account: DeskAccount = {
    userId: input.userId,
    mode: input.mode,
    deskType: "flex",
    copyOfAccountId: null,
    venue,
    venueEnvironment: parseStoredVenueEnvironment(
      venue,
      (accountRow as { venue_environment?: unknown } | null)?.venue_environment,
    ),
  };
  const opens = (openRows ?? []).map((row) =>
    parseFuturesPositionRow(row as Record<string, unknown>),
  );
  const savedBooks = savedExitBooks(openRows ?? []);
  const klineCache = new Map<string, CandleBar[]>();
  const needsPrice = matchedRows.some((raw) => {
    const rule = parseFuturesAutomationRow(raw as Record<string, unknown>);
    return (
      Boolean(rule.exitActions?.length) ||
      Boolean(rule.shortEntry?.actions?.length) ||
      perpsAutomationLegs(rule).some(
        (leg) =>
          leg.rule.entrySource === "price" ||
          leg.rule.entrySource === "retrace" ||
          leg.rule.entryStack.leaves.some(
            (leaf) => leaf.kind === "price" || leaf.kind === "retrace",
          ) ||
          (leg.rule.addStack?.leaves ?? []).some(
            (leaf) => leaf.kind === "price" || leaf.kind === "retrace",
          ) ||
          leg.rule.exitHard?.trigger === "price" ||
          (leg.rule.exitStack?.leaves ?? []).some((leaf) => leaf.kind === "price"),
      )
    );
  });
  let tickers = new Map<string, BybitTicker>();
  if (needsPrice) {
    tickers = (await loadDeskTickerMap(
      account.venue,
      account.venueEnvironment,
    ).catch(() => new Map())) as Map<string, BybitTicker>;
  }
  let fired = 0;
  for (const raw of matchedRows) {
    const rule = parseFuturesAutomationRow(raw as Record<string, unknown>);
    if (!rule.id) {
      continue;
    }
    const exitWebhookHit = ruleUsesExitWebhook(rule, input.webhookId) ||
      (["long", "short"] as const).some((side) => {
      const exit = perpsExitForSide(rule, side);
      return (
        (exit.exitHard?.trigger === "webhook" &&
          exit.exitHard.webhookId === input.webhookId) ||
        exit.exitStack.leaves.some(
          (leaf) =>
            leaf.kind === "webhook" && leaf.webhookId === input.webhookId,
        )
      );
    });
    if (exitWebhookHit) {
      const owned = opens.filter(
        (row) => row.ruleId === rule.id && row.symbol === rule.symbol,
      );
      const barsByTimeframe = await loadRuleBars({
        rule,
        account,
        cache: klineCache,
      });
      const ticker = tickers.get(rule.symbol);
      const prices = ticker ? tickerTriggerPrices(ticker) : null;
      let flattened = false;
      for (const open of owned) {
        const ownedExit = await commitOwnedExit({
          rule,
          account,
          open,
          barsByTimeframe,
          prices,
          firedWebhookId: input.webhookId,
        });
        if (ownedExit) {
          if (ownedExit === "flat") {
            flattened = true;
          }
          continue;
        }
        const exit = perpsExitForSide(rule, open.side);
        const exitBars = exit.exitIf
          ? (barsByTimeframe.get(exit.exitIf.timeframe) ?? [])
          : [];
        const first = hardExitMet({
          filter: exit.exitIf,
          signal: exit.exitHard,
          side: open.side,
          closes: exitBars.map((row) => row.close),
          bars: exitBars,
          prices,
          firedWebhookId: input.webhookId,
        });
        if (
          !exitExpressionMet({
            first,
            stack: exit.exitStack,
            side: open.side,
            price: prices?.last ?? null,
            prices,
            barsByTimeframe,
            firedWebhookId: input.webhookId,
          })
        ) {
          continue;
        }
        const reasons = formatExitExpressionText({
          filter: exit.exitIf,
          signal: exit.exitHard,
          stack: exit.exitStack,
          side: open.side,
        });
        const closed = await runFuturesCommand({
          actor: {
            userId: input.userId,
            accountId: input.accountId,
            mode: input.mode,
          },
          command: {
            kind: "place",
            action: "flatten",
            symbol: open.symbol,
            positionId: open.id,
            orderType: "market",
            source: "webhook",
            ruleId: rule.id,
            ruleName: rule.name,
            reason: reasons,
          },
        });
        if (closed.ok) {
          fired += 1;
          flattened = true;
          await writeEventLog({
            scope: "trade",
            event: "engine.exit_if",
            message: futuresHardExitMessage({
              name: rule.name,
              symbol: open.symbol,
              reasons,
            }),
            userId: input.userId,
            accountId: input.accountId,
            strategy: FUTURES_STRATEGY_ID,
            data: {
              ruleId: rule.id,
              ruleName: rule.name,
              symbol: open.symbol,
              side: open.side,
              positionId: open.id,
              webhookId: input.webhookId,
              reason: reasons,
            },
          });
        }
      }
      if (flattened) {
        continue;
      }
    }
    const barsByTimeframe = await loadRuleBars({
      rule,
      account,
      cache: klineCache,
    });
    const ticker = tickers.get(rule.symbol);
    const prices = ticker ? tickerTriggerPrices(ticker) : null;
    const webhookLegs = perpsAutomationLegs(rule).filter((leg) =>
      entryStackMatchesWebhook(
        leg.rule.entrySource,
        leg.rule.webhookId,
        leg.rule.entryStack,
        input.webhookId,
      ),
    );
    for (const leg of webhookLegs) {
      const legRule = leg.rule;
      const side = leg.side;
      const openOnSide = opens.find(
        (row) => row.symbol === rule.symbol && row.side === side,
      );
      const price = prices ? triggerPrice(legRule.triggerBy, prices) : null;
      const decision = decideFuturesAutomationTick({
        conditionMet: futuresEntryConditionMet({
          rule: legRule,
          side,
          price,
          prices,
          barsByTimeframe,
          firedWebhookId: input.webhookId,
        }),
        wasTrue: false,
        action: legRule.action,
        mode: rule.mode,
        bookReduceOnly,
        skipIfOpen: legRule.skipIfOpen,
        hasOpenOnSide: Boolean(openOnSide),
      });
      if (!decision.fire) {
        if (addStackMatchesWebhook(legRule.addStack, input.webhookId)) {
          const added = await placeFlexAdd({
            supabase,
            rule,
            legRule,
            latch: leg.latch,
            side,
            accountId: input.accountId,
            userId: input.userId,
            mode: input.mode,
            open: openOnSide ?? null,
            price,
            prices,
            barsByTimeframe,
            firedWebhookId: input.webhookId,
            savedBook: openOnSide ? (savedBooks.get(openOnSide.id) ?? null) : null,
          });
          fired += added;
        }
        continue;
      }
      const reasons = formatFuturesEntryReasons({
        entrySource: legRule.entrySource,
        side,
        triggerBy: legRule.triggerBy,
        triggerCompare: legRule.triggerCompare,
        triggerPrice: legRule.triggerPrice,
        indicator: legRule.indicator,
        confirm: legRule.confirm,
        entryStack: legRule.entryStack,
        retrace: legRule.retrace,
      });
      const result = await fireAutomationRule({
        rule: legRule,
        accountId: input.accountId,
        userId: input.userId,
        mode: input.mode,
        positionId: openOnSide?.id ?? null,
        reason: reasons,
      });
      if (result.ok) {
        fired += 1;
        await writeEventLog({
          scope: "trade",
          event: "engine.fired",
          message: futuresFiredMessage({
            name: rule.name,
            symbol: rule.symbol,
            action: legRule.action,
            closeSide: legRule.closeSide,
            reasons,
            webhook: true,
          }),
          userId: input.userId,
          accountId: input.accountId,
          strategy: FUTURES_STRATEGY_ID,
          data: {
            ruleId: rule.id,
            ruleName: rule.name,
            symbol: rule.symbol,
            side,
            action: legRule.action,
            positionId: result.positionId,
            webhookId: input.webhookId,
            entrySource: legRule.entrySource,
            reason: reasons,
          },
        });
        const addMemory = openOnSide
          ? retraceForOpen({
              stored: legRule.addRetrace,
              open: openOnSide,
              prices,
              barsByTimeframe,
            })
          : null;
        const addNow = flexAddDecision({
          stack: legRule.addStack,
          side,
          price,
          prices,
          barsByTimeframe,
          wasTrue: false,
          open: true,
          firedWebhookId: input.webhookId,
          protection: openOnSide
            ? {
                openQty: openOnSide.qty,
                ...flexAddCoverage({
                  open: openOnSide,
                  rule,
                  prices,
                  savedBook: savedBooks.get(openOnSide.id) ?? null,
                }),
              }
            : null,
          positionRetrace:
            addMemory && openOnSide
              ? { average: openOnSide.entryPrice, memory: addMemory }
              : null,
        });
        await patchRule(supabase, rule.id, {
          [flexAddLatchColumn(leg.latch)]: addNow.met,
          ...(addMemory
            ? {
                [flexAddRetraceColumn(leg.latch)]:
                  positionRetraceToJson(addMemory),
              }
            : {}),
          last_fired_at: new Date().toISOString(),
        });
      } else if (
        isBybitAgreementQuiet(result.error) ||
        isBybitAgreementReject(result.error)
      ) {
        if (!openOnSide) {
          await patchRule(supabase, rule.id, { mode: "disabled" });
          break;
        }
      } else {
        await writeEventLog({
          level: "warning",
          scope: "trade",
          event: "engine.open_failed",
          message: reasons
            ? `${result.error} Trying: ${reasons}.`
            : result.error,
          userId: input.userId,
          accountId: input.accountId,
          strategy: FUTURES_STRATEGY_ID,
          data: {
            ruleId: rule.id,
            ruleName: rule.name,
            symbol: rule.symbol,
            side,
            webhookId: input.webhookId,
            positionId: openOnSide?.id ?? null,
            reason: reasons,
          },
        });
      }
    }
  }
  return { fired };
}

function ruleUsesExitWebhook(
  rule: FuturesAutomationRule,
  webhookId: string,
): boolean {
  const lists = [rule.exitActions, rule.shortEntry?.actions];
  for (const list of lists) {
    for (const action of list ?? []) {
      for (const group of action.groups) {
        for (const draft of [group.anchor, ...group.rows]) {
          if (draft.trigger === "webhook" && draft.webhookId === webhookId) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

async function commitOwnedExit(input: {
  rule: FuturesAutomationRule;
  account: DeskAccount;
  open: FuturesPosition;
  barsByTimeframe: Map<string, CandleBar[]>;
  prices: { last: number | null; mark: number | null; index: number | null } | null;
  firedWebhookId?: string | null;
}): Promise<false | "held" | "flat"> {
  const actions = sideExitActions(
    input.rule.exitActions,
    input.rule.shortEntry?.actions,
    input.rule.direction,
    input.open.side,
  );
  if (!actions) {
    return false;
  }
  const mark = input.prices?.mark ?? input.prices?.last ?? null;
  const last = input.prices?.last ?? mark;
  if (!(mark != null && mark > 0) || !(last != null && last > 0)) {
    return "held";
  }
  const settled = await decideOpenExit({
    actions,
    positionId: input.open.id,
    side: input.open.side,
    qty: input.open.qty,
    entryPrice: input.open.entryPrice,
    mark,
    last,
    index: input.prices?.index ?? null,
    barsByTimeframe: input.barsByTimeframe,
    firedWebhookId: input.firedWebhookId,
    breakevenDone: input.open.breakevenDone,
  });
  if (!settled) {
    return "held";
  }
  if (settled.breakeven && !input.open.breakevenDone) {
    const current = tpslFromRow(input.open);
    const stop = futuresBreakevenStop({
      side: input.open.side,
      entryPrice: input.open.entryPrice,
      currentStop: current?.stopLoss ?? input.open.stopLoss,
      offsetPct: settled.breakeven.offsetPct,
    });
    if (stop != null && stop > 0) {
      const reasons = formatBreakevenReason({
        side: input.open.side,
        entryPrice: input.open.entryPrice,
        mark: last,
        activationPct: settled.breakeven.activationPct,
        offsetPct: settled.breakeven.offsetPct,
        stop,
      });
      const moved = await runFuturesCommand({
        actor: {
          userId: input.account.userId,
          accountId: input.open.accountId,
          mode: input.account.mode,
        },
        command: {
          kind: "set-tpsl",
          positionId: input.open.id,
          symbol: input.open.symbol,
          form: new FormData(),
          reason: reasons,
          tpsl: breakevenStopTpsl({
            current: current ?? {
              takeProfit: input.open.takeProfit,
              stopLoss: stop,
              tpTrigger: input.open.tpTrigger,
              slTrigger: input.open.slTrigger,
              mode: input.open.tpslMode,
              tpQty: input.open.tpQty,
              slQty: input.open.slQty,
              tpOrderType: input.open.tpOrderType,
              slOrderType: "market",
              tpLimitPrice: input.open.tpLimitPrice,
              slLimitPrice: null,
            },
            stop,
            positionQty: input.open.qty,
            appliesQty: settled.breakeven.qty,
          }),
        },
      });
      if (moved.ok) {
        input.open.breakevenDone = true;
        const supabase = createServiceClient();
        if (supabase) {
          await supabase
            .from("futures_positions")
            .update({ breakeven_done: true })
            .eq("id", input.open.id)
            .eq("status", "open");
        }
      }
    }
  }
  if (settled.claims.length === 0) {
    await saveExitRuntime(input.open.id, settled.runtime);
    return "held";
  }
  const full = exitClaimsCover(settled.claims, input.open.qty);
  if (input.account.mode === "paper") {
    const applied = await applyPaperExitClaims({
      mode: input.account.mode,
      position: input.open,
      price: last,
      claims: settled.claims,
      runtime: settled.runtime,
    });
    return applied.applied && applied.remaining <= 1e-8 ? "flat" : "held";
  }
  if (!full) {
    await saveExitRuntime(input.open.id, settled.runtime);
    return "held";
  }
  const closed = await runFuturesCommand({
    actor: {
      userId: input.account.userId,
      accountId: input.open.accountId,
      mode: input.account.mode,
    },
    command: {
      kind: "place",
      action: "flatten",
      symbol: input.open.symbol,
      positionId: input.open.id,
      orderType: "market",
      source: input.firedWebhookId ? "webhook" : "engine",
      ruleId: input.rule.id,
      ruleName: input.rule.name,
      reason: "exit_actions",
    },
  });
  if (!closed.ok) {
    return "held";
  }
  await saveExitRuntime(input.open.id, settled.runtime);
  return "flat";
}

async function monitorOwnedFuturesPositions(input: {
  opens: FuturesPosition[];
  rules: {
    rawAccountId: string;
    rule: FuturesAutomationRule;
    account: DeskAccount;
  }[];
  tickers: Map<string, BybitTicker>;
  deskTickerCache: Map<string, Map<string, BybitTicker>>;
  klineCache: Map<string, CandleBar[]>;
  providedTickers: boolean;
}): Promise<void> {
  const byId = new Map(
    input.rules
      .filter((row) => row.rule.id)
      .map((row) => [row.rule.id as string, row]),
  );
  for (const open of input.opens) {
    if (!open.ruleId) {
      continue;
    }
    const owned = byId.get(open.ruleId);
    if (!owned || owned.rule.action === "flatten") {
      continue;
    }
    const { rule, account } = owned;
    const sideActions = sideExitActions(
      rule.exitActions,
      rule.shortEntry?.actions,
      rule.direction,
      open.side,
    );
    const watchedExit = perpsExitForSide(rule, open.side);
    const sideClassic =
      open.side === "short" && rule.direction === "both"
        ? (rule.shortEntry?.classic ?? null)
        : null;
    const breakevenActivationPct = sideClassic
      ? sideClassic.breakevenActivationPct
      : rule.breakevenActivationPct;
    const breakevenOffsetPct = sideClassic
      ? sideClassic.breakevenOffsetPct
      : rule.breakevenOffsetPct;
    let deskTickers = input.tickers;
    if (account.venue === "hyperliquid" && !input.providedTickers) {
      const cacheKey = `${account.venue}:${account.venueEnvironment ?? ""}`;
      if (!input.deskTickerCache.has(cacheKey)) {
        input.deskTickerCache.set(
          cacheKey,
          (await loadDeskTickerMap(
            account.venue,
            account.venueEnvironment,
          ).catch(() => new Map())) as Map<string, BybitTicker>,
        );
      }
      deskTickers = input.deskTickerCache.get(cacheKey) ?? input.tickers;
    }
    const ticker = deskTickers.get(open.symbol);
    const last = ticker ? triggerPrice("last", tickerTriggerPrices(ticker)) : null;
    const barsByTimeframe = await loadRuleBars({
      rule,
      account,
      cache: input.klineCache,
    });
    const prices = ticker ? tickerTriggerPrices(ticker) : null;
    const exitBars = watchedExit.exitIf
      ? (barsByTimeframe.get(watchedExit.exitIf.timeframe) ?? [])
      : [];
    if (sideActions) {
      await commitOwnedExit({
        rule,
        account,
        open,
        barsByTimeframe,
        prices,
      });
      continue;
    }
    const mark = prices?.mark != null && prices.mark > 0 ? prices.mark : last;
    if (mark != null && mark > 0 && last != null && last > 0 && open.qty > 0) {
      const breakevenMoving =
        breakevenActivationPct != null &&
        futuresBreakevenDue({
          side: open.side,
          qty: open.qty,
          entryPrice: open.entryPrice,
          mark: last,
          activationPct: breakevenActivationPct,
          done: open.breakevenDone,
        });
      const book = exitBookForClassic({
        side: open.side,
        qty: open.qty,
        entryPrice: open.entryPrice,
        mark,
        last,
        nowMs: Date.now(),
        breakevenDone: open.breakevenDone,
        trailingPeak: open.trailingPeak,
        takeProfitPrice: open.takeProfit,
        takeProfitQty: open.tpQty,
        stopLossPrice: open.stopLoss,
        stopLossQty: open.slQty,
        trailingDistance: open.trailingStop,
        trailingActivation: open.trailingActive,
        breakevenActivationPct,
        breakevenOffsetPct,
            breakeven: breakevenMoving
          ? {
              activationPct: breakevenActivationPct,
              offsetPct: breakevenOffsetPct ?? 0,
              qty: null,
            }
          : null,
      });
      await saveExitRuntime(open.id, { arms: {}, book });
    }
    const exitMet = exitExpressionMet({
      first: hardExitMet({
        filter: watchedExit.exitIf,
        signal: watchedExit.exitHard,
        side: open.side,
        closes: exitBars.map((row) => row.close),
        bars: exitBars,
        prices,
      }),
      stack: watchedExit.exitStack,
      side: open.side,
      price: prices?.last ?? null,
      prices,
      barsByTimeframe,
    });
    if (exitMet) {
      const reasons = formatExitExpressionText({
        filter: watchedExit.exitIf,
        signal: watchedExit.exitHard,
        stack: watchedExit.exitStack,
        side: open.side,
      });
      const closed = await runFuturesCommand({
        actor: {
          userId: account.userId,
          accountId: open.accountId,
          mode: account.mode,
        },
        command: {
          kind: "place",
          action: "flatten",
          symbol: open.symbol,
          positionId: open.id,
          orderType: "market",
          source: "engine",
          ruleId: rule.id,
          ruleName: rule.name,
          reason: reasons,
        },
      });
      if (closed.ok) {
        await writeEventLog({
          scope: "trade",
          event: "engine.exit_if",
          message: futuresHardExitMessage({
            name: rule.name,
            symbol: open.symbol,
            reasons,
          }),
          userId: account.userId,
          accountId: open.accountId,
          strategy: FUTURES_STRATEGY_ID,
          data: {
            ruleId: rule.id,
            ruleName: rule.name,
            symbol: open.symbol,
            side: open.side,
            positionId: open.id,
            reason: reasons,
          },
        });
      } else {
        await writeEventLog({
          level: "warning",
          scope: "trade",
          event: "engine.exit_if_failed",
          message: `${closed.error} Trying Hard Exit: ${reasons}.`,
          userId: account.userId,
          accountId: open.accountId,
          strategy: FUTURES_STRATEGY_ID,
          data: {
            ruleId: rule.id,
            symbol: open.symbol,
            positionId: open.id,
            reason: reasons,
          },
        });
      }
      continue;
    }
    if (
      last != null &&
      futuresBreakevenDue({
        side: open.side,
        qty: open.qty,
        entryPrice: open.entryPrice,
        mark: last,
        activationPct: breakevenActivationPct,
        done: open.breakevenDone,
      })
    ) {
      const current = tpslFromRow(open);
      const stop = futuresBreakevenStop({
        side: open.side,
        entryPrice: open.entryPrice,
        currentStop: current?.stopLoss ?? open.stopLoss,
        offsetPct: breakevenOffsetPct,
      });
      if (stop == null || !(stop > 0)) {
        continue;
      }
      const reasons = formatBreakevenReason({
        side: open.side,
        entryPrice: open.entryPrice,
        mark: last,
        activationPct: breakevenActivationPct ?? 0,
        offsetPct: breakevenOffsetPct,
        stop,
      });
      const moved = await runFuturesCommand({
        actor: {
          userId: account.userId,
          accountId: open.accountId,
          mode: account.mode,
        },
        command: {
          kind: "set-tpsl",
          positionId: open.id,
          symbol: open.symbol,
          form: new FormData(),
          reason: reasons,
          tpsl: breakevenStopTpsl({
            current: current ?? {
              takeProfit: open.takeProfit,
              stopLoss: stop,
              tpTrigger: open.tpTrigger,
              slTrigger: open.slTrigger,
              mode: open.tpslMode,
              tpQty: open.tpQty,
              slQty: open.slQty,
              tpOrderType: open.tpOrderType,
              slOrderType: "market",
              tpLimitPrice: open.tpLimitPrice,
              slLimitPrice: null,
            },
            stop,
            positionQty: open.qty,
          }),
        },
      });
      if (!moved.ok) {
        await writeEventLog({
          level: "warning",
          scope: "trade",
          event: "engine.breakeven_failed",
          message: `${moved.error} Trying: ${reasons}.`,
          userId: account.userId,
          accountId: open.accountId,
          strategy: FUTURES_STRATEGY_ID,
          data: {
            ruleId: rule.id,
            symbol: open.symbol,
            positionId: open.id,
            reason: reasons,
          },
        });
        continue;
      }
      const supabase = createServiceClient();
      if (supabase) {
        await supabase
          .from("futures_positions")
          .update({ breakeven_done: true })
          .eq("id", open.id)
          .eq("status", "open");
      }
      await writeEventLog({
        scope: "trade",
        event: "engine.breakeven",
        message: futuresBreakevenMessage({
          name: rule.name,
          symbol: open.symbol,
          reasons,
        }),
        userId: account.userId,
        accountId: open.accountId,
        strategy: FUTURES_STRATEGY_ID,
        data: {
          ruleId: rule.id,
          ruleName: rule.name,
          symbol: open.symbol,
          side: open.side,
          positionId: open.id,
          stop,
          reason: reasons,
        },
      });
    }
  }
}

async function loadRuleBars(input: {
  rule: FuturesAutomationRule;
  account: DeskAccount;
  cache: Map<string, CandleBar[]>;
}): Promise<Map<DcaIndicatorTimeframe, CandleBar[]>> {
  if (!futuresAutomationNeedsBars(input.rule)) {
    return emptyBarsByTimeframe();
  }
  const barsByTimeframe = emptyBarsByTimeframe();
  const wide = futuresAutomationNeedsWideBars(input.rule);
  for (const timeframe of futuresAutomationTimeframes(input.rule)) {
    const key = `${input.account.venue}:${input.rule.symbol}:${timeframe}`;
    if (!input.cache.has(key)) {
      const fetched = await loadDeskIndicatorBars({
        venue: input.account.venue,
        venueEnvironment: input.account.venueEnvironment,
        symbol: input.rule.symbol,
        interval: timeframe,
        limit: wide ? 500 : 80,
      }).catch((error: unknown) => {
        console.error(
          "engine perps indicator bars",
          input.rule.symbol,
          timeframe,
          error instanceof Error ? error.message : error,
        );
        return [];
      });
      input.cache.set(key, fetched);
    }
    barsByTimeframe.set(timeframe, input.cache.get(key) ?? []);
  }
  return barsByTimeframe;
}

function savedExitBooks(
  rows: readonly unknown[],
): Map<string, ExitBookSnapshot> {
  const books = new Map<string, ExitBookSnapshot>();
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const row = raw as { id?: unknown; exit_runtime?: unknown };
    const id = String(row.id ?? "");
    const book = exitRuntimeFromJson(row.exit_runtime).book;
    if (id && book) {
      books.set(id, book);
    }
  }
  return books;
}

/** Protective coverage for a Flex add, from the last exit book or the position columns. */
function flexAddCoverage(input: {
  open: FuturesPosition;
  rule: FuturesAutomationRule;
  prices: { last: number | null; mark: number | null; index: number | null } | null;
  savedBook: ExitBookSnapshot | null;
}): { provenPct: number | null; noLossProvenPct: number | null } {
  const none = { provenPct: null, noLossProvenPct: null };
  const actions = sideExitActions(
    input.rule.exitActions,
    input.rule.shortEntry?.actions,
    input.rule.direction,
    input.open.side,
  );
  if (actions && input.savedBook) {
    return {
      provenPct: input.savedBook.protective.provenPct,
      noLossProvenPct: input.savedBook.noLoss.provenPct,
    };
  }
  const last = input.prices?.last ?? input.prices?.mark ?? null;
  const mark =
    input.prices?.mark != null && input.prices.mark > 0
      ? input.prices.mark
      : last;
  if (!(mark != null && mark > 0) || !(last != null && last > 0)) {
    return none;
  }
  if (actions) {
    const book = describeExitBook({
      source: "actions",
      actions,
      runtime: emptyExitRuntime(),
      lots: [
        {
          id: input.open.id,
          qty: input.open.qty,
          price: input.open.entryPrice,
        },
      ],
      side: input.open.side,
      mark,
      last,
      entryPrice: input.open.entryPrice,
      nowMs: Date.now(),
      claims: [],
      breakevenDone: input.open.breakevenDone,
      prices: input.prices,
    });
    return {
      provenPct: book.protective.provenPct,
      noLossProvenPct: book.noLoss.provenPct,
    };
  }
  const sideClassic =
    input.open.side === "short" && input.rule.direction === "both"
      ? (input.rule.shortEntry?.classic ?? null)
      : null;
  const breakevenActivationPct = sideClassic
    ? sideClassic.breakevenActivationPct
    : input.rule.breakevenActivationPct;
  const breakevenOffsetPct = sideClassic
    ? sideClassic.breakevenOffsetPct
    : input.rule.breakevenOffsetPct;
  const breakevenMoving =
    breakevenActivationPct != null &&
    futuresBreakevenDue({
      side: input.open.side,
      qty: input.open.qty,
      entryPrice: input.open.entryPrice,
      mark: last,
      activationPct: breakevenActivationPct,
      done: input.open.breakevenDone,
    });
  const book = exitBookForClassic({
    side: input.open.side,
    qty: input.open.qty,
    entryPrice: input.open.entryPrice,
    mark,
    last,
    nowMs: Date.now(),
    breakevenDone: input.open.breakevenDone,
    trailingPeak: input.open.trailingPeak,
    takeProfitPrice: input.open.takeProfit,
    takeProfitQty: input.open.tpQty,
    stopLossPrice: input.open.stopLoss,
    stopLossQty: input.open.slQty,
    trailingDistance: input.open.trailingStop,
    trailingActivation: input.open.trailingActive,
    breakevenActivationPct,
    breakevenOffsetPct,
    breakeven: breakevenMoving
      ? {
          activationPct: breakevenActivationPct,
          offsetPct: breakevenOffsetPct ?? 0,
          qty: null,
        }
      : null,
  });
  return {
    provenPct: book.protective.provenPct,
    noLossProvenPct: book.noLoss.provenPct,
  };
}

function postEntryWick(
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>,
  openedAtMs: number,
): { high: number; low: number } | null {
  let chosen: CandleBar | null = null;
  let rank = Number.POSITIVE_INFINITY;
  for (const [timeframe, bars] of barsByTimeframe) {
    const bar = bars[bars.length - 1];
    if (!bar || !(bar.high > 0) || !(bar.low > 0) || bar.timeMs < openedAtMs) {
      continue;
    }
    const index = DCA_INDICATOR_TIMEFRAMES.indexOf(timeframe);
    if (index >= 0 && index < rank) {
      rank = index;
      chosen = bar;
    }
  }
  return chosen ? { high: chosen.high, low: chosen.low } : null;
}

function retraceForOpen(input: {
  stored: PositionRetraceMemory | null | undefined;
  open: FuturesPosition;
  prices: { last: number | null; mark: number | null; index: number | null } | null;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
}): PositionRetraceMemory | null {
  return resumePositionRetrace({
    stored: input.stored ?? null,
    positionKey: input.open.id,
    initial: input.open.entryPrice,
    quotes: input.prices ?? {},
    wick: postEntryWick(input.barsByTimeframe, input.open.openedAtMs),
  });
}

/**
 * Place one Flex additional order on the rising edge, while the position is open.
 * A failed place leaves the latch clear so the next check tries again.
 * Retrace arms update only after the order is placed.
 */
async function placeFlexAdd(input: {
  supabase: NonNullable<ReturnType<typeof createServiceClient>>;
  rule: FuturesAutomationRule;
  legRule: FuturesAutomationRule;
  latch: "condition_true" | "short_condition_true";
  side: FuturesSide;
  accountId: string;
  userId: string;
  mode: TradingAccountMode;
  open: FuturesPosition | null;
  price: number | null;
  prices: { last: number | null; mark: number | null; index: number | null } | null;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
  firedWebhookId?: string | null;
  savedBook: ExitBookSnapshot | null;
}): Promise<number> {
  const stack = input.legRule.addStack;
  if (!stack || stack.leaves.length === 0 || !input.rule.id) {
    return 0;
  }
  if (
    input.firedWebhookId &&
    !addStackMatchesWebhook(stack, input.firedWebhookId)
  ) {
    return 0;
  }
  const column = flexAddLatchColumn(input.latch);
  const retraceColumn = flexAddRetraceColumn(input.latch);
  const wasTrue = input.legRule.addConditionTrue === true;
  if (!input.open || input.open.status !== "open") {
    if (!input.open && (wasTrue || input.legRule.addRetrace)) {
      await patchRule(input.supabase, input.rule.id, {
        [column]: false,
        [retraceColumn]: null,
      });
    }
    return 0;
  }
  const memory = retraceForOpen({
    stored: input.legRule.addRetrace,
    open: input.open,
    prices: input.prices,
    barsByTimeframe: input.barsByTimeframe,
  });
  const decision = flexAddDecision({
    stack,
    side: input.side,
    price: input.price,
    prices: input.prices,
    barsByTimeframe: input.barsByTimeframe,
    wasTrue,
    open: true,
    firedWebhookId: input.firedWebhookId,
    protection: {
      openQty: input.open.qty,
      ...flexAddCoverage({
        open: input.open,
        rule: input.rule,
        prices: input.prices,
        savedBook: input.savedBook,
      }),
    },
    positionRetrace: memory
      ? { average: input.open.entryPrice, memory }
      : null,
  });
  const previousRetrace = input.legRule.addRetrace
    ? JSON.stringify(positionRetraceToJson(input.legRule.addRetrace))
    : null;
  const nextRetrace = memory ? JSON.stringify(positionRetraceToJson(memory)) : null;
  const retraceChanged = nextRetrace !== previousRetrace;
  if (!decision.fire || !decision.order) {
    if (decision.nextTrue !== wasTrue || retraceChanged) {
      await patchRule(input.supabase, input.rule.id, {
        ...(decision.nextTrue !== wasTrue ? { [column]: decision.nextTrue } : {}),
        ...(memory && retraceChanged
          ? { [retraceColumn]: positionRetraceToJson(memory) }
          : {}),
      });
    }
    return 0;
  }
  const result = await fireAutomationRule({
    rule: input.legRule,
    accountId: input.accountId,
    userId: input.userId,
    mode: input.mode,
    positionId: input.open.id,
    reason: decision.because,
    add: decision.order,
  });
  if (!result.ok) {
    await writeEventLog({
      level: "warning",
      scope: "trade",
      event: "engine.add_failed",
      message: decision.because
        ? `${result.error} Trying: ${decision.because}.`
        : result.error,
      userId: input.userId,
      accountId: input.accountId,
      strategy: FUTURES_STRATEGY_ID,
      data: {
        ruleId: input.rule.id,
        ruleName: input.rule.name,
        symbol: input.rule.symbol,
        side: input.side,
        positionId: input.open.id,
        reason: decision.because,
      },
    });
    if (memory && retraceChanged) {
      await patchRule(input.supabase, input.rule.id, {
        [retraceColumn]: positionRetraceToJson(memory),
      });
    }
    return 0;
  }
  await writeEventLog({
    scope: "trade",
    event: "engine.added",
    message: futuresAddedMessage({
      name: input.rule.name,
      symbol: input.rule.symbol,
      side: input.side,
      reasons: decision.because,
    }),
    userId: input.userId,
    accountId: input.accountId,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      ruleId: input.rule.id,
      ruleName: input.rule.name,
      symbol: input.rule.symbol,
      side: input.side,
      positionId: result.positionId,
      reason: decision.because,
    },
  });
  const firedLeaves =
    decision.group == null ? [] : (addStackGroups(stack)[decision.group] ?? []);
  const armed = memory
    ? commitPositionRetraceFire(memory, firedLeaves)
    : null;
  await patchRule(input.supabase, input.rule.id, {
    [column]:
      armed && positionRetraceConsumed(firedLeaves) ? false : true,
    ...(armed ? { [retraceColumn]: positionRetraceToJson(armed) } : {}),
    last_fired_at: new Date().toISOString(),
  });
  return 1;
}

async function fireAutomationRule(input: {
  rule: FuturesAutomationRule;
  accountId: string;
  userId: string;
  mode: TradingAccountMode;
  positionId: string | null;
  reason?: string;
  /** Group size for a Flex additional order. Stops already on the position stay. */
  add?: AddGroupOrder;
}): Promise<
  { ok: true; positionId: string | null } | { ok: false; error: string }
> {
  const rule = input.rule;
  if (!rule.id) {
    return { ok: false, error: "Rule is missing an id." };
  }
  const adding = input.add != null;
  const exitOwned =
    rule.action === "flatten" ||
    sideExitActions(
      rule.exitActions,
      rule.shortEntry?.actions,
      rule.direction,
      rule.action === "sell" ? "short" : "long",
    );
  const result = await runFuturesCommand({
    actor: {
      userId: input.userId,
      accountId: input.accountId,
      mode: input.mode,
    },
    command: {
      kind: "place",
      action: rule.action,
      symbol: rule.symbol,
      orderType: adding ? input.add!.orderType : rule.orderType,
      positionId: rule.action === "flatten" ? input.positionId : undefined,
      size: adding
        ? input.add!.size
        : rule.size == null
          ? ""
          : String(rule.size),
      sizeUnit: adding ? input.add!.sizeUnit : rule.sizeUnit,
      limitPrice: adding
        ? input.add!.orderType === "limit"
          ? input.add!.limitPrice
          : undefined
        : rule.limitPrice == null
          ? undefined
          : String(rule.limitPrice),
      idempotencyKey:
        futuresAutomationIdempotencyKey(rule.id, Date.now()) +
        (adding ? "add" : ""),
      source: "engine",
      ruleId: rule.id,
      ruleName: rule.name,
      reason: input.reason,
      tpsl: adding || exitOwned ? null : rule.tpsl,
      trailing: adding || exitOwned ? null : rule.trailing,
    },
  });
  if (!result.ok) {
    return result;
  }
  return { ok: true, positionId: result.positionId ?? input.positionId };
}

async function patchRule(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("futures_automation_rules")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
}
