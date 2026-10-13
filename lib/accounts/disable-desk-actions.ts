"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth/session";
import {
  deskUsesCashAndCarry,
  type TradingAccount,
} from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import {
  closePositionsDetail,
  deskDisableBotKind,
  disableBotsDetail,
  type DeskDisableBotKind,
} from "@/lib/accounts/disable-desk";
import {
  loadDeskCopySettings,
  saveDeskCopySettings,
} from "@/lib/copy/follower-settings";
import { dcaPlaybookIsRunning } from "@/lib/dca/playbook";
import {
  listDcaPlaybooksForAccount,
  resetDcaPlaybook,
} from "@/lib/dca/store";
import { CLOSE_ALL_CONFIRM } from "@/lib/futures/close-all";
import {
  loadFuturesPositions,
  loadLiveFuturesWorking,
} from "@/lib/futures/list";
import {
  markFuturesPendingClose,
  selectIds,
} from "@/lib/futures/pending-close";
import { runFuturesCommand } from "@/lib/futures/run-command";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { writeEventLog } from "@/lib/logs/write";
import { closePaperCarryMarket } from "@/lib/paper/actions";
import { parsePaperCarryRow } from "@/lib/paper/rows";
import { createServiceClient } from "@/lib/supabase/admin";

export type DisableDeskStepResult =
  | {
      ok: true;
      detail: string;
      closed: number;
      cancelled: number;
    }
  | { ok: false; error: string };

async function requireOwnedDesk(
  accountId: string,
): Promise<
  | { ok: true; userId: string; account: TradingAccount }
  | { ok: false; error: string }
> {
  const id = accountId.trim();
  if (!id) {
    return { ok: false, error: "That desk was not found." };
  }
  const session = await getSessionContext();
  if (!session) {
    return { ok: false, error: "Sign in to continue." };
  }
  const accounts = await listTradingAccounts(session.member.id);
  const account = accounts.find((row) => row.id === id);
  if (!account) {
    return { ok: false, error: "That desk was not found." };
  }
  return { ok: true, userId: session.member.id, account };
}

function refreshDeskSurfaces(): void {
  revalidatePath("/account/sub-accounts");
  revalidatePath("/strategies/futures/positions");
  revalidatePath("/strategies/futures/automations");
  revalidatePath("/strategies/futures/orders");
  revalidatePath("/strategies/cash-and-carry");
  revalidatePath("/strategies/cash-and-carry/automations");
}

async function turnOffModeRows(input: {
  table: "futures_automation_rules" | "paper_rules";
  userId: string;
  accountId: string;
  kind: DeskDisableBotKind;
}): Promise<DisableDeskStepResult> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Auth is not configured." };
  }
  const { data, error } = await supabase
    .from(input.table)
    .select("id, mode")
    .eq("account_id", input.accountId)
    .eq("user_id", input.userId);
  if (error) {
    return { ok: false, error: error.message };
  }
  const turnedOff = (data ?? []).filter(
    (row) => String((row as { mode?: unknown }).mode ?? "") !== "disabled",
  ).length;
  if (turnedOff > 0) {
    const updated = await supabase
      .from(input.table)
      .update({ mode: "disabled" })
      .eq("account_id", input.accountId)
      .eq("user_id", input.userId)
      .neq("mode", "disabled");
    if (updated.error) {
      return { ok: false, error: updated.error.message };
    }
  }
  if (input.table === "paper_rules") {
    const settings = await supabase
      .from("paper_engine_settings")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq("account_id", input.accountId)
      .eq("user_id", input.userId);
    if (settings.error) {
      return { ok: false, error: settings.error.message };
    }
  }
  const detail = disableBotsDetail({ kind: input.kind, turnedOff });
  if (turnedOff > 0) {
    await writeEventLog({
      scope: "strategy",
      event: "desk.bots_disabled",
      message: detail,
      userId: input.userId,
      accountId: input.accountId,
      strategy:
        input.kind === "cnc" ? "cash-and-carry" : FUTURES_STRATEGY_ID,
      data: { turnedOff, kind: input.kind },
    });
  }
  return { ok: true, detail, closed: 0, cancelled: 0 };
}

async function turnOffDcaBots(
  userId: string,
  accountId: string,
): Promise<DisableDeskStepResult> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Auth is not configured." };
  }
  const playbooks = await listDcaPlaybooksForAccount(accountId, supabase);
  const running = playbooks.filter((playbook) => dcaPlaybookIsRunning(playbook));
  for (const playbook of running) {
    const reset = await resetDcaPlaybook({ supabase, id: playbook.id });
    if (!reset.ok) {
      return { ok: false, error: reset.error };
    }
  }
  const detail = disableBotsDetail({
    kind: "dca",
    turnedOff: running.length,
  });
  if (running.length > 0) {
    await writeEventLog({
      scope: "strategy",
      event: "desk.bots_disabled",
      message: detail,
      userId,
      accountId,
      strategy: FUTURES_STRATEGY_ID,
      data: { turnedOff: running.length, kind: "dca" },
    });
  }
  return { ok: true, detail, closed: 0, cancelled: 0 };
}

async function pauseCopyDesk(
  userId: string,
  account: TradingAccount,
): Promise<DisableDeskStepResult> {
  const current = await loadDeskCopySettings(account.id);
  if (current.paused) {
    return {
      ok: true,
      detail: disableBotsDetail({ kind: "copy", turnedOff: 0 }),
      closed: 0,
      cancelled: 0,
    };
  }
  const saved = await saveDeskCopySettings({
    accountId: account.id,
    paused: true,
  });
  if (!saved.ok) {
    return { ok: false, error: saved.error };
  }
  const detail = disableBotsDetail({ kind: "copy", turnedOff: 1 });
  await writeEventLog({
    scope: "trade",
    event: "copy.paused",
    message: "Paused copying from the parent desk",
    userId,
    accountId: account.id,
    strategy: FUTURES_STRATEGY_ID,
    data: { parentAccountId: account.copyOfAccountId, source: "disable-desk" },
  });
  return { ok: true, detail, closed: 0, cancelled: 0 };
}

export async function disableDeskBots(
  accountId: string,
): Promise<DisableDeskStepResult> {
  const owned = await requireOwnedDesk(accountId);
  if (!owned.ok) {
    return owned;
  }
  const kind = deskDisableBotKind(owned.account);
  let result: DisableDeskStepResult;
  if (kind === "copy") {
    result = await pauseCopyDesk(owned.userId, owned.account);
  } else if (kind === "cnc") {
    result = await turnOffModeRows({
      table: "paper_rules",
      userId: owned.userId,
      accountId: owned.account.id,
      kind,
    });
  } else if (kind === "perps") {
    result = await turnOffModeRows({
      table: "futures_automation_rules",
      userId: owned.userId,
      accountId: owned.account.id,
      kind,
    });
  } else if (kind === "dca") {
    result = await turnOffDcaBots(owned.userId, owned.account.id);
  } else {
    result = {
      ok: true,
      detail: disableBotsDetail({ kind: "none", turnedOff: 0 }),
      closed: 0,
      cancelled: 0,
    };
  }
  if (result.ok) {
    refreshDeskSurfaces();
  }
  return result;
}

async function closeCashAndCarryPositions(
  userId: string,
  account: TradingAccount,
): Promise<DisableDeskStepResult> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Auth is not configured." };
  }
  const { data, error } = await supabase
    .from("paper_carries")
    .select("*")
    .eq("account_id", account.id)
    .eq("user_id", userId)
    .in("status", ["open", "closing"]);
  if (error) {
    return { ok: false, error: error.message };
  }
  const rows = (data ?? []).map((row) =>
    parsePaperCarryRow(row as Record<string, unknown>),
  );
  const open = rows.filter((row) => row.status === "open");
  const pendingOnly = open.length === 0 && rows.length > 0;
  let closed = 0;
  for (const row of open) {
    const result = await closePaperCarryMarket({
      supabase,
      userId,
      accountId: account.id,
      accountMode: account.mode,
      row,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    closed += 1;
  }
  return {
    ok: true,
    detail: closePositionsDetail({ closed, cancelled: 0, pendingOnly }),
    closed,
    cancelled: 0,
  };
}

async function closeFuturesPositions(
  userId: string,
  account: TradingAccount,
): Promise<DisableDeskStepResult> {
  const scope = { accountId: account.id, userId };
  const [positions, working] = await Promise.all([
    loadFuturesPositions({ status: "open", scope }),
    loadLiveFuturesWorking(scope),
  ]);
  const openPositions = positions.filter((row) => row.status === "open");
  const openWorking = working.filter((row) => row.status === "open");
  const livePositions = positions.filter(
    (row) => row.status === "open" || row.status === "closing",
  );
  const liveWorking = working.filter(
    (row) => row.status === "open" || row.status === "cancelling",
  );
  if (livePositions.length === 0 && liveWorking.length === 0) {
    return {
      ok: true,
      detail: closePositionsDetail({
        closed: 0,
        cancelled: 0,
        pendingOnly: false,
      }),
      closed: 0,
      cancelled: 0,
    };
  }
  if (openPositions.length > 0 || openWorking.length > 0) {
    const marked = await markFuturesPendingClose({
      accountId: account.id,
      userId,
      positionIds: selectIds(openPositions),
      workingIds: selectIds(openWorking),
    });
    if (!marked.ok) {
      return marked;
    }
  }
  const result = await runFuturesCommand({
    actor: {
      userId,
      accountId: account.id,
      mode: account.mode,
    },
    command: {
      kind: "close-all",
      scope: "all",
      confirm: CLOSE_ALL_CONFIRM,
    },
  });
  if (!result.ok) {
    if (
      result.error === "Nothing to cancel or close." ||
      result.error === "Nothing to close." ||
      result.error === "Nothing to cancel."
    ) {
      return {
        ok: true,
        detail: closePositionsDetail({
          closed: 0,
          cancelled: 0,
          pendingOnly: livePositions.length > 0 || liveWorking.length > 0,
        }),
        closed: 0,
        cancelled: 0,
      };
    }
    return result;
  }
  return {
    ok: true,
    detail: closePositionsDetail({
      closed: livePositions.length,
      cancelled: liveWorking.length,
      pendingOnly: false,
    }),
    closed: livePositions.length,
    cancelled: liveWorking.length,
  };
}

export async function closeDeskPositions(
  accountId: string,
): Promise<DisableDeskStepResult> {
  const owned = await requireOwnedDesk(accountId);
  if (!owned.ok) {
    return owned;
  }
  const result = deskUsesCashAndCarry(owned.account.deskType)
    ? await closeCashAndCarryPositions(owned.userId, owned.account)
    : await closeFuturesPositions(owned.userId, owned.account);
  if (result.ok) {
    refreshDeskSurfaces();
  }
  return result;
}
