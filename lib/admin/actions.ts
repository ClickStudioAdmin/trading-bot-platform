"use server";

import { AUTO_TICK_COOKIE } from "@/lib/admin/settings";
import { requireAdmin } from "@/lib/admin/access";
import { parseCopyMinActivityDays } from "@/lib/copy/model";
import { saveCopyMinActivityDays } from "@/lib/copy/settings";
import { SESSION_DAYS } from "@/lib/auth/token";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveAdminSettings(formData: FormData) {
  await requireAdmin();
  const days = parseCopyMinActivityDays(formData.get("copyMinActivityDays"));
  if (!days.ok) {
    redirect("/admin/settings?error=copy-days");
  }
  const savedDays = await saveCopyMinActivityDays(days.days);
  if (!savedDays.ok) {
    redirect("/admin/settings?error=copy-days");
  }
  const enabled = formData.get("autoTick") === "on";
  const store = await cookies();
  const expiresAtMs = Date.now() + SESSION_DAYS * 86_400_000;
  store.set(AUTO_TICK_COOKIE, enabled ? "1" : "0", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAtMs),
  });
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}
