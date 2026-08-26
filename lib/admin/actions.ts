"use server";

import { AUTO_TICK_COOKIE } from "@/lib/admin/settings";
import { requireAdmin } from "@/lib/admin/access";
import { SESSION_DAYS } from "@/lib/auth/token";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveAdminSettings(formData: FormData) {
  await requireAdmin();
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
