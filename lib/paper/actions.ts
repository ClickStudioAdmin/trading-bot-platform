"use server";

import { writeEventLog } from "@/lib/logs/write";
import { EMPTY_AUTOMATION, parseCarryExitForm } from "@/lib/paper/automation";
import {
  insertPaperOrder,
  priorClosesFromOrders,
  writeCloseClip,
} from "@/lib/paper/ledger";
import { parsePaperOrderRow } from "@/lib/paper/orders";
import { unwindClipUsdt } from "@/lib/engine/clip";
import { loadUsableBookShare } from "@/lib/engine/settings";
import { usableBookUsdt } from "@/lib/opportunities/capacity";
import {
  paperCarryInsertRow,
  parseNotionalUsdt,
  safePaperReturnPath,
  sizeOpenNotional,
} from "@/lib/paper/open";
import { asNumber, parsePaperCarryRow } from "@/lib/paper/rows";
import { persistOpportunities } from "@/lib/opportunities/persist";
import { scanOneOpportunity } from "@/lib/opportunities/scan";
import { getSessionContext } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function openPaperCarry(formData: FormData) {
  const next = safePaperReturnPath(String(formData.get("next") ?? ""));
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;
  if (account.mode !== "paper") {
    redirect(
      `${next}?paperError=${encodeURIComponent("This is a Connected Exchange account. Paper fills are off until live execution exists.")}`,
    );
  }

  const supabase = createServiceClient();
  if (!supabase) {
    redirect(`${next}?paperError=${encodeURIComponent("Auth is not configured.")}`);
  }

  const spotSymbol = String(formData.get("spotSymbol") ?? "");
  const futureSymbol = String(formData.get("futureSymbol") ?? "");
  const requested = parseNotionalUsdt(String(formData.get("notionalUsdt") ?? ""));
  const shownUsableUsdt = parseNotionalUsdt(
    String(formData.get("shownCapacityUsdt") ?? ""),
  );
  if (!spotSymbol || !futureSymbol || requested === null) {
    redirect(`${next}?paperError=${encodeURIComponent("Enter a positive USDT notional.")}`);
  }

  let match;
  try {
    match = await scanOneOpportunity({ spotSymbol, futureSymbol });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Scan failed";
    redirect(`${next}?paperError=${encodeURIComponent(message)}`);
  }

  if (!match) {
    redirect(
      `${next}?paperError=${encodeURIComponent("That pair is not in the live scan.")}`,
    );
  }

  const usableCapacityUsdt = usableBookUsdt(
    match.capacityUsdt,
    await loadUsableBookShare(),
  );
  const sized = sizeOpenNotional(
    requested,
    usableCapacityUsdt,
    shownUsableUsdt,
  );
  if (sized === null) {
    redirect(
      `${next}?paperError=${encodeURIComponent("Size cannot exceed usable book.")}`,
    );
  }
  const rawScan = match;
  match = { ...match, capacityUsdt: usableCapacityUsdt };

  const { data, error } = await supabase
    .from("paper_carries")
    .insert(
      paperCarryInsertRow(user.id, match, sized, {
        accountId: account.id,
      }),
    )
    .select("id")
    .single();

  if (error) {
    await writeEventLog({
      level: "error",
      scope: "trade",
      event: "trade.open_failed",
      message: error.message,
      userId: user.id,
      accountId: account.id,
      strategy: "cash-and-carry",
      data: { spotSymbol, futureSymbol, notionalUsdt: sized },
    });
    redirect(`${next}?paperError=${encodeURIComponent(error.message)}`);
  }

  if (!data) {
    redirect(`${next}?paper=opened`);
  }

  const carryId = asNumber(data.id);
  await insertPaperOrder(supabase, {
    userId: user.id,
    accountId: account.id,
    carryId,
    side: "open",
    source: "manual",
    triggerReason: null,
    notionalUsdt: sized,
    filledAt: new Date(),
    opportunity: match,
    automation: EMPTY_AUTOMATION,
  });

  await writeEventLog({
    scope: "trade",
    event: "trade.opened",
    message: `Opened paper ${futureSymbol}`,
    userId: user.id,
    accountId: account.id,
    strategy: "cash-and-carry",
    data: {
      carryId,
      spotSymbol,
      futureSymbol,
      notionalUsdt: sized,
      entryBasis: match.netBasis,
      source: "manual",
    },
  });

  await persistOpportunities([rawScan]);

  redirect(`${next}?paper=opened`);
}

export async function closeOpenPaperCarry(formData: FormData) {
  const next = safePaperReturnPath(String(formData.get("next") ?? ""));
  const mode = String(formData.get("mode") ?? "market");
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;

  const supabase = createServiceClient();
  if (!supabase) {
    redirect(`${next}?paperError=${encodeURIComponent("Auth is not configured.")}`);
  }

  let carryId: number;
  try {
    carryId = asNumber(formData.get("carryId"));
  } catch {
    redirect(`${next}?paperError=${encodeURIComponent("Missing paper carry.")}`);
  }

  const { data, error: loadError } = await supabase
    .from("paper_carries")
    .select("*")
    .eq("id", carryId)
    .eq("account_id", account.id)
    .in("status", ["open", "closing"])
    .maybeSingle();

  if (loadError || !data) {
    redirect(
      `${next}?paperError=${encodeURIComponent("That paper carry is not open.")}`,
    );
  }

  const row = parsePaperCarryRow(data as Record<string, unknown>);

  let match;
  try {
    match = await scanOneOpportunity({
      spotSymbol: row.spotSymbol,
      futureSymbol: row.futureSymbol,
      baseCoin: row.baseCoin,
      deliveryTimeMs: row.deliveryTimeMs,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Scan failed";
    redirect(`${next}?paperError=${encodeURIComponent(message)}`);
  }

  if (!match) {
    redirect(
      `${next}?paperError=${encodeURIComponent("That pair is not in the live scan, so it cannot be marked or closed.")}`,
    );
  }

  await persistOpportunities([match]);
  const usableCapacityUsdt = usableBookUsdt(
    match.capacityUsdt,
    await loadUsableBookShare(),
  );
  match = { ...match, capacityUsdt: usableCapacityUsdt };

  let clipUsdt = row.notionalUsdt;
  let reason: "unwind" | null = null;
  if (mode === "unwind") {
    const clip = unwindClipUsdt(row.notionalUsdt, usableCapacityUsdt, null);
    if (clip === null) {
      const { error } = await supabase
        .from("paper_carries")
        .update({
          status: "closing",
          close_source: "manual",
          close_reason: "unwind",
        })
        .eq("id", carryId)
        .eq("account_id", account.id)
        .in("status", ["open", "closing"]);
      if (error) {
        redirect(`${next}?paperError=${encodeURIComponent(error.message)}`);
      }
      redirect(`${next}?paper=unwinding`);
    }
    clipUsdt = clip;
    reason = "unwind";
  }

  const { data: orderRows } = await supabase
    .from("paper_orders")
    .select("*")
    .eq("account_id", account.id)
    .eq("carry_id", carryId);

  const written = await writeCloseClip({
    supabase,
    userId: user.id,
    accountId: account.id,
    row,
    opportunity: match,
    clipUsdt,
    source: "manual",
    reason,
    priorCloses: priorClosesFromOrders(
      (orderRows ?? []).map((item) =>
        parsePaperOrderRow(item as Record<string, unknown>),
      ),
      carryId,
    ),
  });

  if (written.error) {
    await writeEventLog({
      level: "error",
      scope: "trade",
      event: "trade.close_failed",
      message: written.error,
      userId: user.id,
      accountId: account.id,
      strategy: "cash-and-carry",
      data: { carryId, mode },
    });
    redirect(`${next}?paperError=${encodeURIComponent(written.error)}`);
  }

  await writeEventLog({
    scope: "trade",
    event: written.kind === "flat" ? "trade.closed" : "trade.unwound",
    message:
      written.kind === "flat"
        ? `Closed paper ${row.futureSymbol}`
        : `Unwound paper ${row.futureSymbol}`,
    userId: user.id,
    accountId: account.id,
    strategy: "cash-and-carry",
    data: {
      carryId,
      futureSymbol: row.futureSymbol,
      clipUsdt,
      source: row.source,
      closeSource: "manual",
      mode,
    },
  });

  redirect(
    written.kind === "flat" ? `${next}?paper=closed` : `${next}?paper=unwinding`,
  );
}

export async function updatePaperCarryExits(formData: FormData) {
  const next = safePaperReturnPath(String(formData.get("next") ?? ""));
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;

  const supabase = createServiceClient();
  if (!supabase) {
    redirect(`${next}?paperError=${encodeURIComponent("Auth is not configured.")}`);
  }

  let carryId: number;
  try {
    carryId = asNumber(formData.get("carryId"));
  } catch {
    redirect(`${next}?paperError=${encodeURIComponent("Missing paper carry.")}`);
  }

  const parsed = parseCarryExitForm(formData);
  if ("error" in parsed) {
    redirect(`${next}?paperError=${encodeURIComponent(parsed.error)}`);
  }

  const { data, error: loadError } = await supabase
    .from("paper_carries")
    .select("*")
    .eq("id", carryId)
    .eq("account_id", account.id)
    .eq("status", "open")
    .eq("source", "engine")
    .maybeSingle();

  if (loadError || !data) {
    redirect(
      `${next}?paperError=${encodeURIComponent("That automated paper carry is not open.")}`,
    );
  }

  const { error } = await supabase
    .from("paper_carries")
    .update({
      close_max_dte: parsed.closeMaxDte,
      close_min_net_apr: parsed.closeMinNetApr,
      take_profit_pct: parsed.takeProfitPct,
      stop_loss_pct: parsed.stopLossPct,
    })
    .eq("id", carryId)
    .eq("account_id", account.id)
    .eq("status", "open")
    .eq("source", "engine");

  if (error) {
    await writeEventLog({
      level: "error",
      scope: "trade",
      event: "trade.exits_failed",
      message: error.message,
      userId: user.id,
      accountId: account.id,
      strategy: "cash-and-carry",
      data: { carryId },
    });
    redirect(`${next}?paperError=${encodeURIComponent(error.message)}`);
  }

  await writeEventLog({
    scope: "trade",
    event: "trade.exits_updated",
    message: `Updated exits for paper ${String(data.future_symbol)}`,
    userId: user.id,
    accountId: account.id,
    strategy: "cash-and-carry",
    data: {
      carryId,
      closeMaxDte: parsed.closeMaxDte,
      closeMinNetApr: parsed.closeMinNetApr,
      takeProfitPct: parsed.takeProfitPct,
      stopLossPct: parsed.stopLossPct,
    },
  });

  redirect(`${next}?paper=exits`);
}
