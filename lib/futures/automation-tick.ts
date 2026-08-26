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
import { fetchBybitTickers } from "@/lib/exchanges/bybit/client";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { triggerPrice, tickerTriggerPrices } from "./tpsl";
import type { TradingAccountMode } from "@/lib/accounts/model";

export async function runFuturesAutomationTick(): Promise<{ fired: number }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { fired: 0 };
  }
  const { data: ruleRows, error: ruleError } = await supabase
    .from("futures_automation_rules")
    .select("*")
    .neq("mode", "disabled")
    .order("sort_order", { ascending: true });
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
    tickers,
  ] = await Promise.all([
    supabase
      .from("trading_accounts")
      .select("id, user_id, mode")
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
    fetchBybitTickers("linear").catch(() => null),
  ]);

  if (!tickers) {
    await writeEventLog({
      level: "warning",
      scope: "strategy",
      event: "engine.open_failed",
      message: "Futures automations skipped: could not read linear tickers.",
      strategy: FUTURES_STRATEGY_ID,
    });
    return { fired: 0 };
  }

  const accounts = new Map(
    (accountRows ?? []).map((row) => [
      String((row as { id: string }).id),
      {
        userId: String((row as { user_id: string }).user_id),
        mode: String((row as { mode: string }).mode) as TradingAccountMode,
      },
    ]),
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

  let fired = 0;
  for (const raw of ruleRows) {
    const rule = parseFuturesAutomationRow(raw as Record<string, unknown>);
    const accountId = String((raw as { account_id: string }).account_id);
    const account = accounts.get(accountId);
    if (!account || !rule.id) {
      continue;
    }
    const ticker = tickers.get(rule.symbol);
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
          data: { ruleId: rule.id, symbol: rule.symbol, action: rule.action },
        });
        continue;
      }
      fired += 1;
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

async function fireAutomationRule(input: {
  rule: FuturesAutomationRule;
  accountId: string;
  userId: string;
  mode: TradingAccountMode;
  positionId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const rule = input.rule;
  if (!rule.id) {
    return { ok: false, error: "Rule is missing an id." };
  }
  return runFuturesCommand({
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
      idempotencyKey: futuresAutomationIdempotencyKey(rule.id),
      source: "engine",
      ruleId: rule.id,
      ruleName: rule.name,
    },
  });
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
