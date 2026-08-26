import { parseDeskType, type TradingAccountMode } from "@/lib/accounts/model";
import { fetchBybitTickers } from "@/lib/exchanges/bybit/client";
import { parseFuturesPositionRow } from "@/lib/futures/model";
import { tickerTriggerPrices } from "@/lib/futures/tpsl";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { decideDcaTick, type DcaPlaybook } from "./playbook";
import { applyDcaVerb, flattenPlaybook, placeClip } from "./run";
import { listDcaPlaybooks, patchDcaPlaybook, resetDcaPlaybook } from "./store";

export async function runDcaPlaybookTick(): Promise<{ acted: number }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { acted: 0 };
  }
  const playbooks = await listDcaPlaybooks(supabase);
  if (playbooks.length === 0) {
    return { acted: 0 };
  }
  const accountIds = [...new Set(playbooks.map((row) => row.accountId))];
  const [
    { data: accountRows },
    { data: settingsRows },
    { data: openRows },
    tickers,
  ] = await Promise.all([
    supabase
      .from("trading_accounts")
      .select("id, user_id, mode, desk_type")
      .in("id", accountIds),
    supabase
      .from("strategy_settings")
      .select("account_id, reduce_only")
      .eq("strategy_id", FUTURES_STRATEGY_ID)
      .in("account_id", accountIds),
    supabase
      .from("futures_positions")
      .select("*")
      .eq("status", "open")
      .in("account_id", accountIds),
    fetchBybitTickers("linear").catch(() => null),
  ]);
  if (!tickers) {
    await writeEventLog({
      level: "warning",
      scope: "strategy",
      event: "engine.open_failed",
      message: "DCA tick skipped: could not read linear tickers.",
      strategy: FUTURES_STRATEGY_ID,
    });
    return { acted: 0 };
  }
  const accounts = new Map(
    (accountRows ?? []).map((row) => [
      String((row as { id: string }).id),
      {
        userId: String((row as { user_id: string }).user_id),
        mode: String((row as { mode: string }).mode) as TradingAccountMode,
        deskType: parseDeskType((row as { desk_type?: unknown }).desk_type),
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

  let acted = 0;
  for (const playbook of playbooks) {
    const account = accounts.get(playbook.accountId);
    if (!account || account.deskType !== "dca") {
      continue;
    }
    const ticker = tickers.get(playbook.symbol) ?? {};
    const prices = tickerTriggerPrices(ticker);
    const open = opens.find(
      (row) =>
        row.accountId === playbook.accountId &&
        row.symbol === playbook.symbol &&
        row.side === playbook.side,
    );
    const decision = decideDcaTick({
      status: playbook.status,
      side: playbook.side,
      reduceOnly: reduceOnly.has(playbook.accountId),
      lastPrice: prices.last,
      mark: prices.mark,
      lastClipPrice: playbook.lastClipPrice,
      lastClipAtMs: playbook.lastClipAtMs,
      nowMs: Date.now(),
      dipPct: playbook.dipPct,
      intervalMinutes: playbook.intervalMinutes,
      clipsFilled: playbook.clipsFilled,
      maxClips: playbook.maxClips,
      maxValue: playbook.maxValue,
      positionQty: open?.qty ?? null,
      entryPrice: open?.entryPrice ?? null,
      takeProfitPct: playbook.takeProfitPct,
      stopLossPct: playbook.stopLossPct,
      armTrigger: playbook.armTrigger,
      armConditionTrue: playbook.armConditionTrue,
      disarmTrigger: playbook.disarmTrigger,
      disarmConditionTrue: playbook.disarmConditionTrue,
      triggerPrices: prices,
    });
    const flags = await patchDcaPlaybook({
      supabase,
      id: playbook.id,
      patch: {
        armConditionTrue: decision.nextArmTrue,
        disarmConditionTrue: decision.nextDisarmTrue,
      },
    });
    if (!flags.ok) {
      continue;
    }
    const result = await applyTickAction({
      playbook,
      mode: account.mode,
      lastPrice: prices.last,
      action: decision.action,
    });
    if (result.acted) {
      acted += 1;
    }
  }
  return { acted };
}

async function applyTickAction(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  lastPrice: number | null;
  action: ReturnType<typeof decideDcaTick>["action"];
}): Promise<{ acted: boolean }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { acted: false };
  }
  if (input.action.kind === "none") {
    return { acted: false };
  }
  if (input.action.kind === "arm") {
    const armed = await applyDcaVerb({
      playbook: input.playbook,
      mode: input.mode,
      verb: "arm",
    });
    return { acted: armed.ok };
  }
  if (input.action.kind === "disarm") {
    const disarmed = await applyDcaVerb({
      playbook: input.playbook,
      mode: input.mode,
      verb: "disarm",
    });
    return { acted: disarmed.ok };
  }
  if (input.action.kind === "stop_adding") {
    const patched = await patchDcaPlaybook({
      supabase,
      id: input.playbook.id,
      patch: { status: "stop_adding" },
    });
    return { acted: patched.ok };
  }
  if (input.action.kind === "clip") {
    if (input.lastPrice === null) {
      return { acted: false };
    }
    const placed = await placeClip({
      playbook: input.playbook,
      mode: input.mode,
      lastPrice: input.lastPrice,
    });
    if (!placed.ok) {
      await writeEventLog({
        level: "warning",
        scope: "trade",
        event: "engine.open_failed",
        message: placed.error,
        userId: input.playbook.userId,
        accountId: input.playbook.accountId,
        strategy: FUTURES_STRATEGY_ID,
        data: { playbookId: input.playbook.id },
      });
      return { acted: false };
    }
    return { acted: true };
  }
  const closed = await flattenPlaybook({
    playbook: input.playbook,
    mode: input.mode,
  });
  if (!closed.ok) {
    await writeEventLog({
      level: "warning",
      scope: "trade",
      event: "engine.open_failed",
      message: closed.error,
      userId: input.playbook.userId,
      accountId: input.playbook.accountId,
      strategy: FUTURES_STRATEGY_ID,
      data: {
        playbookId: input.playbook.id,
        reason: input.action.reason,
      },
    });
    return { acted: false };
  }
  await resetDcaPlaybook({ supabase, id: input.playbook.id });
  await writeEventLog({
    scope: "trade",
    event: "dca.closed",
    message:
      input.action.reason === "take_profit"
        ? `${input.playbook.name} hit take profit.`
        : `${input.playbook.name} hit stop loss.`,
    userId: input.playbook.userId,
    accountId: input.playbook.accountId,
    strategy: FUTURES_STRATEGY_ID,
    data: { playbookId: input.playbook.id, reason: input.action.reason },
  });
  return { acted: true };
}
