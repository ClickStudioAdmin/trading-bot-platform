"use server";

import { requirePerpsUiSession } from "@/lib/accounts/guard";
import type { TradingAccountMode } from "@/lib/accounts/model";
import { dcaSaveVerb, parseDcaBotStatus } from "@/lib/bots/status";
import {
  dcaConfigMaxOrderError,
  dcaEnabledSides,
  dcaLegFor,
  dcaPlaybookHasOpenCycle,
  dcaPlaybookIsRunning,
  dcaStartListens,
  parseDcaPlaybookId,
  resolveDcaSaveConfig,
  parseDcaSaveIntent,
  type DcaPlaybook,
  type DcaPlaybookConfig,
} from "@/lib/dca/playbook";
import { loadOpenFuturesOnSymbol } from "@/lib/futures/list";
import { parseFuturesSide, type FuturesSide } from "@/lib/futures/model";
import {
  applyDcaVerb,
  lastPriceFor,
  parseDcaPlaybookVerb,
  syncDcaPlaybookWorking,
  type DcaVerb,
} from "@/lib/dca/run";
import { afterDeskWork } from "@/lib/ui/after-desk-work";
import { loadDcaBookUsdt, loadDcaSizingLeverage } from "@/lib/dca/book";
import { loadUsdtLinearPerps } from "@/lib/exchanges/bybit/perp";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";
import { loadHyperliquidLinearPerps } from "@/lib/venues/hyperliquid/market";
import {
  deleteDcaPlaybook,
  loadDcaPlaybookById,
  patchDcaLeg,
  resetDcaLeg,
  resetDcaPlaybook,
  saveDcaPlaybook,
} from "@/lib/dca/store";
import { writeEventLog } from "@/lib/logs/write";
import { deskAllowsDcaPlaybooks, withQuery } from "@/lib/accounts/model";
import { safeFuturesReturnPath } from "@/lib/futures/path";
import { FUTURES_PATHS, FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { deskActionError, type DeskActionResult } from "@/lib/ui/desk-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type DcaDeskActionResult = DeskActionResult & {
  playbook?: DcaPlaybook;
  deletedId?: string;
};

async function syncRunningPlaybookWorking(input: {
  playbook: Parameters<typeof syncDcaPlaybookWorking>[0]["playbook"];
  mode: Parameters<typeof syncDcaPlaybookWorking>[0]["mode"];
}): Promise<void> {
  if (!dcaPlaybookIsRunning(input.playbook)) {
    return;
  }
  await syncDcaPlaybookWorking({
    playbook: input.playbook,
    mode: input.mode,
  });
}

function deferDcaVerb(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  verb: DcaVerb;
  side?: FuturesSide | null;
  userId: string;
  accountId: string;
}): void {
  afterDeskWork(`dca-${input.verb}`, async () => {
    const result = await applyDcaVerb({
      playbook: input.playbook,
      mode: input.mode,
      verb: input.verb,
      side: input.side,
    });
    if (!result.ok) {
      await writeEventLog({
        level: "error",
        scope: "trade",
        event: "engine.close_failed",
        message: result.error,
        userId: input.userId,
        accountId: input.accountId,
        strategy: FUTURES_STRATEGY_ID,
        data: { playbookId: input.playbook.id, verb: input.verb },
      });
    }
    revalidatePath(FUTURES_PATHS.automations);
    revalidatePath(FUTURES_PATHS.positions);
  });
}

async function persistDcaVerbStatus(input: {
  playbook: DcaPlaybook;
  verb: DcaVerb;
  side?: FuturesSide | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Auth is not configured." };
  }
  const sides = input.side
    ? [input.side]
    : dcaEnabledSides(input.playbook.direction);
  if (input.verb === "close-playbook") {
    return resetDcaPlaybook({ supabase, id: input.playbook.id });
  }
  if (input.verb === "arm") {
    for (const side of sides) {
      const patched = await patchDcaLeg({
        supabase,
        id: input.playbook.id,
        side,
        patch: { status: "armed" },
      });
      if (!patched.ok) {
        return patched;
      }
    }
    return { ok: true };
  }
  if (input.verb === "disarm") {
    const opens = await loadOpenFuturesOnSymbol(input.playbook.symbol, {
      accountId: input.playbook.accountId,
      userId: input.playbook.userId,
    });
    for (const side of sides) {
      const openQty = opens.find((row) => row.side === side)?.qty ?? 0;
      const patched =
        openQty > 0
          ? await patchDcaLeg({
              supabase,
              id: input.playbook.id,
              side,
              patch: { status: "stop_adding" },
            })
          : await resetDcaLeg({
              supabase,
              id: input.playbook.id,
              side,
            });
      if (!patched.ok) {
        return patched;
      }
    }
    return { ok: true };
  }
  return { ok: true };
}

function noticeForDcaVerb(verb: DcaVerb, ownsOpen: boolean): string {
  if (verb === "close-playbook") {
    return ownsOpen ? "Bot saved. Closing positions…" : "Bot saved.";
  }
  if (verb === "close-position") {
    return "Closing this position…";
  }
  if (verb === "disarm") {
    return ownsOpen ? "Bot saved. Stopping adds." : "Bot saved.";
  }
  if (verb === "arm") {
    return "Bot saved. Turning on…";
  }
  return "Bot saved.";
}

async function acceptDcaVerb(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  verb: DcaVerb;
  side?: FuturesSide | null;
  userId: string;
  accountId: string;
  ownsOpen?: boolean;
}): Promise<DcaDeskActionResult> {
  const persisted = await persistDcaVerbStatus({
    playbook: input.playbook,
    verb: input.verb,
    side: input.side,
  });
  if (!persisted.ok) {
    return deskActionError(persisted.error);
  }
  deferDcaVerb(input);
  const playbook =
    (await loadDcaPlaybookById(input.playbook.id, input.accountId)) ??
    input.playbook;
  revalidatePath(FUTURES_PATHS.automations);
  revalidatePath(FUTURES_PATHS.positions);
  return {
    ok: true,
    notice: noticeForDcaVerb(input.verb, Boolean(input.ownsOpen)),
    playbook,
  };
}

export async function saveDcaPlaybookAction(
  formData: FormData,
): Promise<DcaDeskActionResult> {
  const selectedRaw = String(formData.get("botStatus") ?? "").trim();
  if (!selectedRaw) {
    return saveDcaPlaybookWith("save", formData);
  }
  const session = await requirePerpsUiSession();
  if (!deskAllowsDcaPlaybooks(session.account)) {
    return deskActionError("This desk is not a DCA desk.");
  }
  const playbookId = parseDcaPlaybookId(formData.get("playbookId"));
  const existing = playbookId
    ? await loadDcaPlaybookById(playbookId, session.account.id)
    : null;
  const opens = existing
    ? await loadOpenFuturesOnSymbol(existing.symbol, {
        accountId: session.account.id,
        userId: session.member.id,
      })
    : [];
  const running = Boolean(existing && dcaPlaybookIsRunning(existing));
  const armed = Boolean(
    existing &&
      dcaEnabledSides(existing.direction).some(
        (side) => dcaLegFor(existing, side).status === "armed",
      ),
  );
  const hasOpenPosition = Boolean(
    existing && dcaPlaybookHasOpenCycle(existing, opens),
  );
  const verb = dcaSaveVerb({
    selected: parseDcaBotStatus(selectedRaw),
    running,
    armed,
    hasOpenPosition,
  });
  if (verb === "arm") {
    return saveDcaPlaybookWith("arm", formData);
  }
  const saved = await saveDcaPlaybookWith("save", formData, {
    skipSync: verb !== "save",
  });
  if (!saved.ok || !saved.playbook || verb === "save") {
    return saved;
  }
  return acceptDcaVerb({
    playbook: saved.playbook,
    mode: session.account.mode,
    verb,
    userId: session.member.id,
    accountId: session.account.id,
    ownsOpen: hasOpenPosition,
  });
}

export async function saveAndArmDcaPlaybookAction(
  formData: FormData,
): Promise<DcaDeskActionResult> {
  return saveDcaPlaybookWith("arm", formData);
}

async function rejectIfOverMaxOrder(
  config: DcaPlaybookConfig,
  desk: {
    id: string;
    venue: string;
    venueEnvironment: string | null;
    mode: "paper" | "live";
  },
  userId: string,
): Promise<string | null> {
  const pairs =
    desk.venue === "hyperliquid"
      ? await loadHyperliquidLinearPerps(
          hyperliquidInfoEnvironment(desk.venueEnvironment),
        ).catch(() => [])
      : await loadUsdtLinearPerps().catch(() => []);
  const pair = pairs.find((row) => row.symbol === config.symbol);
  if (!pair) {
    return "That contract is not available.";
  }
  const lastPrice = await lastPriceFor(config.symbol, desk);
  const bookUsdt = await loadDcaBookUsdt({
    userId,
    accountId: desk.id,
    mode: desk.mode,
  });
  const leverage = await loadDcaSizingLeverage({
    userId,
    accountId: desk.id,
    mode: desk.mode,
    symbol: config.symbol,
    side: dcaEnabledSides(config.direction)[0] ?? "long",
  });
  return dcaConfigMaxOrderError({
    config,
    lastPrice,
    maxQty: pair.maxQty,
    maxMktQty: pair.maxMktQty,
    minQty: pair.minQty,
    minNotional: pair.minNotional,
    minPrice: pair.minPrice,
    tickSize: pair.tickSize,
    baseCoin: pair.baseCoin,
    bookUsdt,
    leverage,
    availableUsdt: bookUsdt,
  });
}

async function saveDcaPlaybookWith(
  intentRaw: string,
  formData: FormData,
  options?: { skipSync?: boolean },
): Promise<DcaDeskActionResult> {
  const session = await requirePerpsUiSession();
  if (!deskAllowsDcaPlaybooks(session.account)) {
    return deskActionError("This desk is not a DCA desk.");
  }
  const playbookId = parseDcaPlaybookId(formData.get("playbookId"));
  const existing = playbookId
    ? await loadDcaPlaybookById(playbookId, session.account.id)
    : null;
  const opens = existing
    ? await loadOpenFuturesOnSymbol(existing.symbol, {
        accountId: session.account.id,
        userId: session.member.id,
      })
    : [];
  const parsed = resolveDcaSaveConfig(
    formData,
    session.account.venue,
    existing,
    opens,
  );
  if (!parsed.ok) {
    return deskActionError(parsed.error);
  }
  const { config, cycleLocked } = parsed;
  if (!cycleLocked) {
    const overMax = await rejectIfOverMaxOrder(
      config,
      session.account,
      session.member.id,
    );
    if (overMax) {
      return deskActionError(overMax);
    }
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return deskActionError("Auth is not configured.");
  }
  const saved = await saveDcaPlaybook({
    supabase,
    userId: session.member.id,
    accountId: session.account.id,
    config,
    id: playbookId,
  });
  if (!saved.ok) {
    return deskActionError(saved.error);
  }
  await writeEventLog({
    scope: "strategy",
    event: "dca.saved",
    message: "Saved DCA bot",
    userId: session.member.id,
    accountId: session.account.id,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      playbookId: saved.playbook.id,
      ruleName: config.name,
      symbol: config.symbol,
      side: config.direction,
    },
  });
  if (!options?.skipSync) {
    afterDeskWork("dca-sync", async () => {
      await syncRunningPlaybookWorking({
        playbook: saved.playbook,
        mode: session.account.mode,
      });
      revalidatePath(FUTURES_PATHS.positions);
    });
  }
  revalidatePath(FUTURES_PATHS.automations);
  if (dcaPlaybookIsRunning(saved.playbook)) {
    revalidatePath(FUTURES_PATHS.positions);
  }
  const intent = parseDcaSaveIntent(intentRaw);
  if (intent === "arm" && dcaStartListens(config.startKind)) {
    return acceptDcaVerb({
      playbook: saved.playbook,
      mode: session.account.mode,
      verb: "arm",
      userId: session.member.id,
      accountId: session.account.id,
    });
  }
  return {
    ok: true,
    notice: cycleLocked
      ? "Saved take profit and stops. Cycle settings stay locked while a position is open."
      : "Bot saved.",
    playbook: saved.playbook,
  };
}

export async function deleteDcaPlaybookAction(
  formData: FormData,
): Promise<DcaDeskActionResult> {
  const session = await requirePerpsUiSession();
  if (!deskAllowsDcaPlaybooks(session.account)) {
    return deskActionError("This desk is not a DCA desk.");
  }
  const id = parseDcaPlaybookId(formData.get("playbookId"));
  if (!id) {
    return deskActionError("That bot was not found.");
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return deskActionError("Auth is not configured.");
  }
  const deleted = await deleteDcaPlaybook({
    supabase,
    id,
    accountId: session.account.id,
  });
  if (!deleted.ok) {
    return deskActionError(deleted.error);
  }
  await writeEventLog({
    scope: "strategy",
    event: "dca.deleted",
    message: "Removed DCA bot",
    userId: session.member.id,
    accountId: session.account.id,
    strategy: FUTURES_STRATEGY_ID,
    data: { playbookId: id },
  });
  return { ok: true, notice: "Bot removed.", deletedId: id };
}

export async function runDcaArmAction(
  formData: FormData,
): Promise<DcaDeskActionResult> {
  return runDcaPlaybookVerb("arm", formData);
}

export async function runDcaArmLongAction(
  formData: FormData,
): Promise<DcaDeskActionResult> {
  return runDcaPlaybookVerb("arm-long", formData);
}

export async function runDcaArmShortAction(
  formData: FormData,
): Promise<DcaDeskActionResult> {
  return runDcaPlaybookVerb("arm-short", formData);
}

export async function runDcaDisarmAction(
  formData: FormData,
): Promise<DcaDeskActionResult> {
  return runDcaPlaybookVerb("disarm", formData);
}

export async function runDcaClosePlaybookAction(
  formData: FormData,
): Promise<DcaDeskActionResult> {
  return runDcaPlaybookVerb("close-playbook", formData);
}

export async function closeDcaPositionFromRow(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const session = await requirePerpsUiSession();
  if (!deskAllowsDcaPlaybooks(session.account)) {
    redirect(withQuery(next, { paperError: "This desk is not a DCA desk." }));
  }
  const id = parseDcaPlaybookId(formData.get("playbookId"));
  const side = parseFuturesSide(formData.get("side"));
  if (!id || !side) {
    redirect(withQuery(next, { paperError: "That bot was not found." }));
  }
  const playbook = await loadDcaPlaybookById(id, session.account.id);
  if (!playbook) {
    redirect(withQuery(next, { paperError: "That bot was not found." }));
  }
  deferDcaVerb({
    playbook,
    mode: session.account.mode,
    verb: "close-position",
    side,
    userId: session.member.id,
    accountId: session.account.id,
  });
  revalidatePath(FUTURES_PATHS.automations);
  revalidatePath(FUTURES_PATHS.positions);
  revalidatePath(FUTURES_PATHS.root);
  redirect(
    withQuery(next, {
      paper:
        session.account.mode === "live" ? "live-closing" : "closing",
    }),
  );
}

export async function runDcaPlaybookVerb(
  verbRaw: string,
  formData: FormData,
): Promise<DcaDeskActionResult> {
  const session = await requirePerpsUiSession();
  if (!deskAllowsDcaPlaybooks(session.account)) {
    return deskActionError("This desk is not a DCA desk.");
  }
  const parsedVerb =
    parseDcaPlaybookVerb(verbRaw) ??
    parseDcaPlaybookVerb(formData.get("verb"));
  if (!parsedVerb) {
    return deskActionError("Choose Arm, Disarm, or Close bot.");
  }
  const { verb, side } = parsedVerb;
  const playbookId = parseDcaPlaybookId(formData.get("playbookId"));
  const existing = playbookId
    ? await loadDcaPlaybookById(playbookId, session.account.id)
    : null;
  const opens = existing
    ? await loadOpenFuturesOnSymbol(existing.symbol, {
        accountId: session.account.id,
        userId: session.member.id,
      })
    : [];
  const parsed = resolveDcaSaveConfig(
    formData,
    session.account.venue,
    existing,
    opens,
  );
  if (!parsed.ok) {
    return deskActionError(parsed.error);
  }
  const { config, cycleLocked } = parsed;
  if (verb === "arm" && !cycleLocked) {
    const overMax = await rejectIfOverMaxOrder(
      config,
      session.account,
      session.member.id,
    );
    if (overMax) {
      return deskActionError(overMax);
    }
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return deskActionError("Auth is not configured.");
  }
  const saved = await saveDcaPlaybook({
    supabase,
    userId: session.member.id,
    accountId: session.account.id,
    config,
    id: playbookId,
  });
  if (!saved.ok) {
    return deskActionError(saved.error);
  }
  const ownsOpen = Boolean(
    saved.playbook && dcaPlaybookHasOpenCycle(saved.playbook, opens),
  );
  return acceptDcaVerb({
    playbook: saved.playbook,
    mode: session.account.mode,
    verb,
    side,
    userId: session.member.id,
    accountId: session.account.id,
    ownsOpen,
  });
}
