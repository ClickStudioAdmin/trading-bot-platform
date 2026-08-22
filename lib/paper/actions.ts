"use server";

import { pairKey, paperCarryInsertRow, parseNotionalUsdt, safePaperReturnPath } from "@/lib/paper/open";
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
    const message =
      error.code === "23505"
        ? "You already have an open paper carry on this pair."
        : error.message;
    redirect(`${next}?paperError=${encodeURIComponent(message)}`);
  }

  redirect(`${next}?paper=opened`);
}
