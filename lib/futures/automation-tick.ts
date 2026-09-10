import {
  automationSide,
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
} from "./conditions";
import { runFuturesCommand } from "./command";
import { parseFuturesPositionRow, type FuturesPosition } from "./model";
import {
  fetchBybitTickers,
  type BybitTicker,
} from "@/lib/exchanges/bybit/client";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { triggerPrice, tickerTriggerPrices, tpslFromRow } from "./tpsl";
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
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";
import type { CandleBar } from "@/lib/market/candles";
import {
  formatBreakevenReason,
  formatFuturesEntryReasons,
  formatHardExitReason,
  futuresBreakevenMessage,
  futuresFiredMessage,
  futuresHardExitMessage,
} from "@/lib/bots/condition-copy";

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
    { data: settingsRows },
    { data: openRows },
    fetchedTickers,
  ] = await Promise.all([
    supabase
      .from("trading_accounts")
      .select("id, user_id, mode, desk_type, venue, venue_environment, copy_of_account_id")
      .in("id", uniqueAccountIds),
    supabase
      .from("strategy_settings")
      .select("account_id, reduce_only")
      .eq("strategy_id", FUTURES_STRATEGY_ID)
      .in("account_id", uniqueAccountIds),
    supabase
      .from("futures_positions")
      .select("*")
      .eq("status", "open")
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
  const reduceOnly = new Set(
    (settingsRows ?? [])
      .filter((row) => Boolean((row as { reduce_only?: unknown }).reduce_only))
      .map((row) => String((row as { account_id: string }).account_id)),
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
    if (rule.entrySource === "webhook") {
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
    const price = prices ? triggerPrice(rule.triggerBy, prices) : null;
    const barsByTimeframe = await loadRuleBars({
      rule,
      account,
      cache: klineCache,
    });
    const side = automationSide(rule);
    const bookOpens = opensByAccount.get(accountId) ?? [];
    const openOnSide = bookOpens.find(
      (row) => row.symbol === rule.symbol && row.side === side,
    );
    const decision = decideFuturesAutomationTick({
      conditionMet: futuresEntryConditionMet({
        rule,
        side,
        price,
        barsByTimeframe,
      }),
      wasTrue: rule.conditionTrue,
      action: rule.action,
      mode: rule.mode,
      bookReduceOnly: reduceOnly.has(accountId),
      skipIfOpen: rule.skipIfOpen,
      hasOpenOnSide: Boolean(openOnSide),
    });
    if (decision.fire) {
      const reasons = formatFuturesEntryReasons({
        entrySource: rule.entrySource,
        side,
        triggerBy: rule.triggerBy,
        triggerCompare: rule.triggerCompare,
        triggerPrice: rule.triggerPrice,
        price,
        indicator: rule.indicator,
        confirm: rule.confirm,
      });
      const result = await fireAutomationRule({
        rule,
        accountId,
        userId: account.userId,
        mode: account.mode,
        positionId: openOnSide?.id ?? null,
        reason: reasons,
      });
      if (!result.ok) {
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
            action: rule.action,
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
          action: rule.action,
          closeSide: rule.closeSide,
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
          action: rule.action,
          positionId: result.positionId,
          entrySource: rule.entrySource,
          reason: reasons,
        },
      });
      await patchRule(supabase, rule.id, {
        condition_true: true,
        last_fired_at: new Date().toISOString(),
      });
      continue;
    }
    if (decision.nextTrue !== rule.conditionTrue) {
      await patchRule(supabase, rule.id, {
        condition_true: decision.nextTrue,
      });
    }
  }

  const { data: latestOpenRows } = await supabase
    .from("futures_positions")
    .select("*")
    .eq("status", "open")
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
    .eq("webhook_id", input.webhookId)
    .eq("entry_source", "webhook")
    .neq("mode", "disabled")
    .order("sort_order", { ascending: true });
  if (!ruleRows || ruleRows.length === 0) {
    return { fired: 0 };
  }
  const [{ data: settingsRow }, { data: openRows }, { data: accountRow }] =
    await Promise.all([
      supabase
        .from("strategy_settings")
        .select("reduce_only")
        .eq("strategy_id", FUTURES_STRATEGY_ID)
        .eq("account_id", input.accountId)
        .maybeSingle(),
      supabase
        .from("futures_positions")
        .select("*")
        .eq("status", "open")
        .eq("account_id", input.accountId),
      supabase
        .from("trading_accounts")
        .select("venue, venue_environment")
        .eq("id", input.accountId)
        .maybeSingle(),
    ]);
  const bookReduceOnly = Boolean(
    (settingsRow as { reduce_only?: unknown } | null)?.reduce_only,
  );
  const venue = parseStoredVenueId(
    (accountRow as { venue?: unknown } | null)?.venue,
  );
  const account: DeskAccount = {
    userId: input.userId,
    mode: input.mode,
    deskType: "perps_bots",
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
  const klineCache = new Map<string, CandleBar[]>();
  let fired = 0;
  for (const raw of ruleRows) {
    const rule = parseFuturesAutomationRow(raw as Record<string, unknown>);
    if (!rule.id) {
      continue;
    }
    const side = automationSide(rule);
    const openOnSide = opens.find(
      (row) => row.symbol === rule.symbol && row.side === side,
    );
    const barsByTimeframe = await loadRuleBars({
      rule,
      account,
      cache: klineCache,
    });
    const decision = decideFuturesAutomationTick({
      conditionMet: futuresEntryConditionMet({
        rule,
        side,
        price: null,
        barsByTimeframe,
      }),
      wasTrue: false,
      action: rule.action,
      mode: rule.mode,
      bookReduceOnly,
      skipIfOpen: rule.skipIfOpen,
      hasOpenOnSide: Boolean(openOnSide),
    });
    if (!decision.fire) {
      continue;
    }
    const reasons = formatFuturesEntryReasons({
      entrySource: rule.entrySource,
      side,
      triggerBy: rule.triggerBy,
      triggerCompare: rule.triggerCompare,
      triggerPrice: rule.triggerPrice,
      indicator: rule.indicator,
      confirm: rule.confirm,
    });
    const result = await fireAutomationRule({
      rule,
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
          action: rule.action,
          closeSide: rule.closeSide,
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
          action: rule.action,
          positionId: result.positionId,
          webhookId: input.webhookId,
          entrySource: rule.entrySource,
          reason: reasons,
        },
      });
      await patchRule(supabase, rule.id, {
        last_fired_at: new Date().toISOString(),
      });
    } else {
      await writeEventLog({
        level: "warning",
        scope: "trade",
        event: "engine.open_failed",
        message: reasons ? `${result.error} Trying: ${reasons}.` : result.error,
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
  return { fired };
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
    if (!rule.exitIf && rule.breakevenActivationPct == null) {
      continue;
    }
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
    if (
      rule.exitIf &&
      futuresFilterMet({
        spec: rule.exitIf,
        side: open.side,
        barsByTimeframe,
      })
    ) {
      const reasons = formatHardExitReason(rule.exitIf, open.side);
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
        activationPct: rule.breakevenActivationPct,
        done: open.breakevenDone,
      })
    ) {
      const current = tpslFromRow(open);
      const stop = futuresBreakevenStop({
        side: open.side,
        entryPrice: open.entryPrice,
        currentStop: current?.stopLoss ?? open.stopLoss,
        offsetPct: rule.breakevenOffsetPct,
      });
      if (stop == null || !(stop > 0)) {
        continue;
      }
      const reasons = formatBreakevenReason({
        side: open.side,
        entryPrice: open.entryPrice,
        mark: last,
        activationPct: rule.breakevenActivationPct ?? 0,
        offsetPct: rule.breakevenOffsetPct,
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
          tpsl: {
            ...(current ?? {
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
            }),
            stopLoss: stop,
            slOrderType: "market",
            slLimitPrice: null,
          },
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

async function fireAutomationRule(input: {
  rule: FuturesAutomationRule;
  accountId: string;
  userId: string;
  mode: TradingAccountMode;
  positionId: string | null;
  reason?: string;
}): Promise<
  { ok: true; positionId: string | null } | { ok: false; error: string }
> {
  const rule = input.rule;
  if (!rule.id) {
    return { ok: false, error: "Rule is missing an id." };
  }
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
      orderType: rule.orderType,
      positionId: rule.action === "flatten" ? input.positionId : undefined,
      size: rule.size == null ? "" : String(rule.size),
      sizeUnit: rule.sizeUnit,
      limitPrice: rule.limitPrice == null ? undefined : String(rule.limitPrice),
      idempotencyKey: futuresAutomationIdempotencyKey(rule.id, Date.now()),
      source: "engine",
      ruleId: rule.id,
      ruleName: rule.name,
      reason: input.reason,
      tpsl: rule.action === "flatten" ? null : rule.tpsl,
      trailing: rule.action === "flatten" ? null : rule.trailing,
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
