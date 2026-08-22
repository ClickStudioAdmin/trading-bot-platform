"use server";

import { closePaperCarry as computeClose } from "@/lib/paper/math";
import { pairKey, paperCarryInsertRow, parseNotionalUsdt, safePaperReturnPath } from "@/lib/paper/open";
import { asNumber, parsePaperCarryRow } from "@/lib/paper/rows";
import { scanCarryOpportunities } from "@/lib/opportunities/scan";
import { createUserClient, getAuthUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function openPaperCarry(formData: FormData) {
  const next = safePaperReturnPath(String(formData.get("next") ?? ""));
  const user = await getAuthUser();
  if (!user) {
    redirect("/sign-in");
  }

  const supabase = await createUserClient();
  if (!supabase) {
    redirect(`${next}?paperError=${encodeURIComponent("Auth is not configured.")}`);
  }

  const spotSymbol = String(formData.get("spotSymbol") ?? "");
  const futureSymbol = String(formData.get("futureSymbol") ?? "");
  const notionalUsdt = parseNotionalUsdt(String(formData.get("notionalUsdt") ?? ""));
  if (!spotSymbol || !futureSymbol || notionalUsdt === null) {
    redirect(`${next}?paperError=${encodeURIComponent("Enter a positive USDT notional.")}`);
  }

  let match;
  try {
    const rows = await scanCarryOpportunities();
    match = rows.find(
      (row) =>
        pairKey(row.spotSymbol, row.futureSymbol) ===
        pairKey(spotSymbol, futureSymbol),
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Scan failed";
    redirect(`${next}?paperError=${encodeURIComponent(message)}`);
  }

  if (!match) {
    redirect(
      `${next}?paperError=${encodeURIComponent("That pair is not in the live scan.")}`,
    );
  }

  const { error } = await supabase.from("paper_carries").insert(
    paperCarryInsertRow(user.id, match, notionalUsdt),
  );

  if (error) {
    redirect(`${next}?paperError=${encodeURIComponent(error.message)}`);
  }

  redirect(`${next}?paper=opened`);
}

export async function closeOpenPaperCarry(formData: FormData) {
  const next = safePaperReturnPath(String(formData.get("next") ?? ""));
  const user = await getAuthUser();
  if (!user) {
    redirect("/sign-in");
  }

  const supabase = await createUserClient();
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
    .eq("status", "open")
    .maybeSingle();

  if (loadError || !data) {
    redirect(
      `${next}?paperError=${encodeURIComponent("That paper carry is not open.")}`,
    );
  }

  const row = parsePaperCarryRow(data as Record<string, unknown>);

  let match;
  try {
    const scan = await scanCarryOpportunities();
    match = scan.find(
      (item) =>
        pairKey(item.spotSymbol, item.futureSymbol) ===
        pairKey(row.spotSymbol, row.futureSymbol),
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Scan failed";
    redirect(`${next}?paperError=${encodeURIComponent(message)}`);
  }

  if (!match) {
    redirect(
      `${next}?paperError=${encodeURIComponent("That pair is not in the live scan, so it cannot be marked or closed.")}`,
    );
  }

  const closedAtMs = Date.now();
  const closed = computeClose({
    entryBasis: row.entryBasis,
    exitBasis: match.netBasis,
    notionalUsdt: row.notionalUsdt,
    feeRate: match.feeRate,
    openedAtMs: row.openedAtMs,
    closedAtMs,
  });

  const { error } = await supabase
    .from("paper_carries")
    .update({
      status: "closed",
      exit_basis: match.netBasis,
      closed_at: new Date(closedAtMs).toISOString(),
      realized_usdt: closed.realizedUsdt,
      days_held: closed.daysHeld,
      realized_apr: closed.realizedApr,
    })
    .eq("id", carryId)
    .eq("status", "open");

  if (error) {
    redirect(`${next}?paperError=${encodeURIComponent(error.message)}`);
  }

  redirect(`${next}?paper=closed`);
}
