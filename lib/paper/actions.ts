"use server";

import { writeEventLog } from "@/lib/logs/write";
import { EMPTY_AUTOMATION, parseCarryExitForm } from "@/lib/paper/automation";
import {
  insertPaperOrder,
  priorClosesFromOrders,
  writeCloseClip,
  writeOpenClip,
} from "@/lib/paper/ledger";
import { clipFillBasis, parsePaperOrderRow } from "@/lib/paper/orders";
import { unwindClipUsdt } from "@/lib/engine/clip";
import { loadUsableBookShare } from "@/lib/engine/settings";
import {
  closeCashAndCarryOnVenue,
  openCashAndCarryOnVenue,
} from "@/lib/exchanges/execute";
import {
  loadBoundVenueForAccount,
  qtyTextForVenueClose,
  venueOrderFields,
} from "@/lib/exchanges/live-trade";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { usableBookUsdt } from "@/lib/opportunities/capacity";
import {
  paperCarryInsertRow,
  parseNotionalUsdt,
  safePaperReturnPath,
  sizeOpenNotional,
} from "@/lib/paper/open";
import {
  asNumber,
  parsePaperCarryRow,
  pickOpenCarryForPair,
} from "@/lib/paper/rows";
import { persistOpportunities } from "@/lib/opportunities/persist";
import { scanOneOpportunity } from "@/lib/opportunities/scan";
import { getSessionContext } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export async function openPaperCarry(formData: FormData) {
  const next = safePaperReturnPath(String(formData.get("next") ?? ""));
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;
  const liveBook = accountCanHoldConnections(account.mode);

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

  let venueFill: Awaited<ReturnType<typeof openCashAndCarryOnVenue>> | null =
    null;
  if (liveBook) {
    const bound = await loadBoundVenueForAccount({
      userId: user.id,
      accountId: account.id,
      mode: account.mode,
    });
    if (!bound.ok) {
      redirect(`${next}?paperError=${encodeURIComponent(bound.error)}`);
    }
    venueFill = await openCashAndCarryOnVenue({
      connection: bound.connection,
      spotSymbol,
      futureSymbol,
      spotAsk: match.spotAsk,
      notionalUsdt: sized,
    });
    if (!venueFill.ok) {
      await writeEventLog({
        level: "error",
        scope: "trade",
        event: "trade.open_failed",
        message: venueFill.error,
        userId: user.id,
        accountId: account.id,
        strategy: "cash-and-carry",
        data: { spotSymbol, futureSymbol, notionalUsdt: sized, venue: "bybit" },
      });
      redirect(`${next}?paperError=${encodeURIComponent(venueFill.error)}`);
    }
  }

  async function flattenVenueOpen() {
    if (!venueFill?.ok) {
      return;
    }
    const bound = await loadBoundVenueForAccount({
      userId: user.id,
      accountId: account.id,
      mode: account.mode,
    });
    if (bound.ok) {
      await closeCashAndCarryOnVenue({
        connection: bound.connection,
        spotSymbol,
        futureSymbol,
        qty: venueFill.fill.qty,
      });
    }
  }

  const existing =
    liveBook && venueFill?.ok
      ? pickOpenCarryForPair(
          (
            await supabase
              .from("paper_carries")
              .select("*")
              .eq("account_id", account.id)
              .eq("spot_symbol", spotSymbol)
              .eq("future_symbol", futureSymbol)
              .eq("status", "open")
          ).data?.map((row) =>
            parsePaperCarryRow(row as Record<string, unknown>),
          ) ?? [],
          spotSymbol,
          futureSymbol,
        )
      : null;

  if (existing && venueFill?.ok) {
    const written = await writeOpenClip({
      supabase,
      userId: user.id,
      accountId: account.id,
      row: existing,
      opportunity: match,
      clipUsdt: sized,
      source: "manual",
      venue: venueFill.fill.venue,
      environment: venueFill.fill.environment,
      spotOrderId: venueFill.fill.spotOrderId,
      futureOrderId: venueFill.fill.futureOrderId,
      fillQty: Number(venueFill.fill.qty),
      fillSpotPrice: venueFill.fill.spotPrice,
      fillFuturePrice: venueFill.fill.futurePrice,
    });
    if (written.error) {
      await flattenVenueOpen();
      await writeEventLog({
        level: "error",
        scope: "trade",
        event: "trade.open_failed",
        message: written.error,
        userId: user.id,
        accountId: account.id,
        strategy: "cash-and-carry",
        data: {
          carryId: existing.id,
          spotSymbol,
          futureSymbol,
          notionalUsdt: sized,
        },
      });
      redirect(`${next}?paperError=${encodeURIComponent(written.error)}`);
    }

    await writeEventLog({
      scope: "trade",
      event: "trade.added",
      message: `Added to ${futureSymbol} on the connected exchange`,
      userId: user.id,
      accountId: account.id,
      strategy: "cash-and-carry",
      data: {
        carryId: existing.id,
        spotSymbol,
        futureSymbol,
        notionalUsdt: sized,
        entryBasis: match.netBasis,
        source: "manual",
        venue: venueFill.fill.venue,
      },
    });

    await persistOpportunities([rawScan]);
    redirect(`${next}?paper=live-added`);
  }

  const { data, error } = await supabase
    .from("paper_carries")
    .insert(
      paperCarryInsertRow(user.id, match, sized, {
        accountId: account.id,
        entryBasis: clipFillBasis(
          match,
          venueFill?.ok ? venueFill.fill.spotPrice : null,
          venueFill?.ok ? venueFill.fill.futurePrice : null,
        ),
      }),
    )
    .select("id")
    .single();

  if (error) {
    await flattenVenueOpen();
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
    venue: venueFill?.ok ? venueFill.fill.venue : null,
    environment: venueFill?.ok ? venueFill.fill.environment : null,
    spotOrderId: venueFill?.ok ? venueFill.fill.spotOrderId : null,
    futureOrderId: venueFill?.ok ? venueFill.fill.futureOrderId : null,
    fillQty: venueFill?.ok ? Number(venueFill.fill.qty) : null,
    fillSpotPrice: venueFill?.ok ? venueFill.fill.spotPrice : null,
    fillFuturePrice: venueFill?.ok ? venueFill.fill.futurePrice : null,
  });

  await writeEventLog({
    scope: "trade",
    event: "trade.opened",
    message: liveBook
      ? `Opened ${futureSymbol} on the connected exchange`
      : `Opened paper ${futureSymbol}`,
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
      venue: venueFill?.ok ? venueFill.fill.venue : undefined,
    },
  });

  await persistOpportunities([rawScan]);

  redirect(`${next}?paper=${liveBook ? "live-opened" : "opened"}`);
}

export async function closeOpenPaperCarry(formData: FormData) {
  const next = safePaperReturnPath(String(formData.get("next") ?? ""));
  const mode = String(formData.get("mode") ?? "market");
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;
  const liveBook = accountCanHoldConnections(account.mode);

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
    reason = "unwind";
    const parked = await parkManualUnwind({
      supabase,
      carryId,
      accountId: account.id,
      userId: user.id,
    });
    if (parked.error) {
      redirect(`${next}?paperError=${encodeURIComponent(parked.error)}`);
    }
    const clip = unwindClipUsdt(row.notionalUsdt, usableCapacityUsdt, null);
    if (clip === null) {
      await writeEventLog({
        level: "warning",
        scope: "trade",
        event: "trade.unwinding",
        message:
          "Unwind queued. Usable book is too small for a clip; later ticks retry.",
        userId: user.id,
        accountId: account.id,
        strategy: "cash-and-carry",
        data: { carryId, futureSymbol: row.futureSymbol },
      });
      redirect(
        `${next}?paper=${liveBook ? "live-unwinding" : "unwinding"}`,
      );
    }
    clipUsdt = clip;
  }

  const { data: orderRows } = await supabase
    .from("paper_orders")
    .select("*")
    .eq("account_id", account.id)
    .eq("carry_id", carryId);

  const orders = (orderRows ?? []).map((item) =>
    parsePaperOrderRow(item as Record<string, unknown>),
  );
  let venueClose: Awaited<ReturnType<typeof closeCashAndCarryOnVenue>> | null =
    null;
  if (liveBook) {
    const bound = await loadBoundVenueForAccount({
      userId: user.id,
      accountId: account.id,
      mode: account.mode,
    });
    if (!bound.ok) {
      redirect(`${next}?paperError=${encodeURIComponent(bound.error)}`);
    }
    const qty = await qtyTextForVenueClose({
      spotSymbol: row.spotSymbol,
      futureSymbol: row.futureSymbol,
      orders,
      clipUsdt,
      remainingNotionalUsdt: row.notionalUsdt,
      spotAsk: match.spotAsk,
    });
    if (!qty.ok) {
      if (mode === "unwind") {
        await writeEventLog({
          level: "warning",
          scope: "trade",
          event: "trade.unwinding",
          message: `${qty.error} Unwind is queued; later ticks retry.`,
          userId: user.id,
          accountId: account.id,
          strategy: "cash-and-carry",
          data: { carryId, mode, venue: "bybit" },
        });
        redirect(
          `${next}?paper=${liveBook ? "live-unwinding" : "unwinding"}`,
        );
      }
      redirect(`${next}?paperError=${encodeURIComponent(qty.error)}`);
    }
    venueClose = await closeCashAndCarryOnVenue({
      connection: bound.connection,
      spotSymbol: row.spotSymbol,
      futureSymbol: row.futureSymbol,
      qty: qty.qty,
    });
    if (!venueClose.ok) {
      await writeEventLog({
        level: "error",
        scope: "trade",
        event: "trade.close_failed",
        message: venueClose.error,
        userId: user.id,
        accountId: account.id,
        strategy: "cash-and-carry",
        data: { carryId, mode, venue: "bybit" },
      });
      if (mode === "unwind") {
        redirect(
          `${next}?paper=${liveBook ? "live-unwinding" : "unwinding"}`,
        );
      }
      redirect(`${next}?paperError=${encodeURIComponent(venueClose.error)}`);
    }
  }

  const written = await writeCloseClip({
    supabase,
    userId: user.id,
    accountId: account.id,
    row,
    opportunity: match,
    clipUsdt,
    source: "manual",
    reason,
    priorCloses: priorClosesFromOrders(orders, carryId),
    ...venueOrderFields(venueClose?.ok ? venueClose.fill : null),
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
        ? liveBook
          ? `Closed ${row.futureSymbol} on the connected exchange`
          : `Closed paper ${row.futureSymbol}`
        : liveBook
          ? `Unwound ${row.futureSymbol} on the connected exchange`
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
    written.kind === "flat"
      ? `${next}?paper=${liveBook ? "live-closed" : "closed"}`
      : `${next}?paper=${liveBook ? "live-unwinding" : "unwinding"}`,
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

async function parkManualUnwind(input: {
  supabase: SupabaseClient;
  carryId: number;
  accountId: string;
  userId: string;
}): Promise<{ error: string | null }> {
  const { error } = await input.supabase
    .from("paper_carries")
    .update({
      status: "closing",
      close_source: "manual",
      close_reason: "unwind",
    })
    .eq("id", input.carryId)
    .eq("account_id", input.accountId)
    .eq("user_id", input.userId)
    .in("status", ["open", "closing"]);
  return { error: error?.message ?? null };
}
