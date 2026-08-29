import {
  automationSide,
  decideFuturesAutomationTick,
  futuresAutomationIdempotencyKey,
  parseFuturesAutomationRow,
  triggerConditionMet,
  type FuturesAutomationRule,
} from "./automation";
import { runFuturesCommand } from "./command";
import { parseFuturesPositionRow, type FuturesPosition } from "./model";
import {
  fetchBybitTickers,
  type BybitTicker,
} from "@/lib/exchanges/bybit/client";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { triggerPrice, tickerTriggerPrices } from "./tpsl";
import {
  deskAllowsPerpsRecipes,
  parseDeskType,
  type TradingAccountMode,
} from "@/lib/accounts/model";
import {
  parseStoredVenueEnvironment,
  parseStoredVenueId,
} from "@/lib/exchanges/venues";
import { loadDeskTickerMap } from "@/lib/market/desk-tickers";

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
      .select("id, user_id, mode, desk_type, venue, venue_environment")
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
  let fired = 0;
  for (const raw of ruleRows) {
    const accountId = String((raw as { account_id: string }).account_id);
    const account = accounts.get(accountId);
    const rule = parseFuturesAutomationRow(
      raw as Record<string, unknown>,
      account?.venue,
    );
    if (rule.entrySource === "webhook") {
      continue;
    }
    if (!account || !rule.id || !deskAllowsPerpsRecipes(account.deskType)) {
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
    if (!ticker) {
      continue;
    }
    const prices = tickerTriggerPrices(ticker);
    const price = triggerPrice(rule.triggerBy, prices);
    if (!(price != null && price > 0)) {
      continue;
    }
    const side = automationSide(rule);
    const bookOpens = opensByAccount.get(accountId) ?? [];
    const openOnSide = bookOpens.find(
      (row) => row.symbol === rule.symbol && row.side === side,
    );
    const decision = decideFuturesAutomationTick({
      conditionMet: triggerConditionMet(
        price,
        rule.triggerCompare,
        rule.triggerPrice,
      ),
      wasTrue: rule.conditionTrue,
      action: rule.action,
      mode: rule.mode,
      bookReduceOnly: reduceOnly.has(accountId),
      skipIfOpen: rule.skipIfOpen,
      hasOpenOnSide: Boolean(openOnSide),
    });
    if (decision.fire) {
      const result = await fireAutomationRule({
        rule,
        accountId,
        userId: account.userId,
        mode: account.mode,
        positionId: openOnSide?.id ?? null,
      });
      if (!result.ok) {
        await writeEventLog({
          level: "warning",
          scope: "trade",
          event: "engine.open_failed",
          message: result.error,
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
          },
        });
        continue;
      }
      fired += 1;
      await writeEventLog({
        scope: "trade",
        event: "engine.fired",
        message: `Automation ${rule.name} fired on ${rule.symbol}.`,
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
  const { data: settingsRow } = await supabase
    .from("strategy_settings")
    .select("reduce_only")
    .eq("strategy_id", FUTURES_STRATEGY_ID)
    .eq("account_id", input.accountId)
    .maybeSingle();
  const { data: openRows } = await supabase
    .from("futures_positions")
    .select("*")
    .eq("status", "open")
    .eq("account_id", input.accountId);
  const bookReduceOnly = Boolean(
    (settingsRow as { reduce_only?: unknown } | null)?.reduce_only,
  );
  const opens = (openRows ?? []).map((row) =>
    parseFuturesPositionRow(row as Record<string, unknown>),
  );
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
    const decision = decideFuturesAutomationTick({
      conditionMet: true,
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
    const result = await fireAutomationRule({
      rule,
      accountId: input.accountId,
      userId: input.userId,
      mode: input.mode,
      positionId: openOnSide?.id ?? null,
    });
    if (result.ok) {
      fired += 1;
      await writeEventLog({
        scope: "trade",
        event: "engine.fired",
        message: `Signal fired ${rule.name} on ${rule.symbol}.`,
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
        message: result.error,
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
        },
      });
    }
  }
  return { fired };
}

async function fireAutomationRule(input: {
  rule: FuturesAutomationRule;
  accountId: string;
  userId: string;
  mode: TradingAccountMode;
  positionId: string | null;
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
