"use server";

import { requireAdmin } from "@/lib/admin/access";
import { readAvailabilityForm } from "@/lib/exchanges/availability";
import { saveVenueAvailability } from "@/lib/exchanges/availability-store";
import { getVenue } from "@/lib/exchanges/venues";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveExchangeAvailability(formData: FormData) {
  await requireAdmin();
  const venue = getVenue(String(formData.get("venue") ?? ""));
  if (!venue) {
    redirect("/admin/exchanges?error=Unknown%20exchange.");
  }
  const cells = readAvailabilityForm(venue, formData);
  const saved = await saveVenueAvailability(venue.id, cells);
  if (!saved.ok) {
    redirect(
      `/admin/exchanges/${venue.id}?error=${encodeURIComponent(saved.error)}`,
    );
  }
  revalidatePath("/admin/exchanges");
  revalidatePath(`/admin/exchanges/${venue.id}`);
  revalidatePath("/account/desks/new");
  redirect(`/admin/exchanges/${venue.id}?saved=1`);
}
