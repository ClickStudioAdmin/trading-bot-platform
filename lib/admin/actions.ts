"use server";

import { AUTO_TICK_COOKIE } from "@/lib/admin/settings";
import { requireAdmin } from "@/lib/admin/access";
import { savePlatformIdentity } from "@/lib/platform/brand";
import {
  parseCopyFollowerLimits,
  parseCopyMinActivityDays,
} from "@/lib/copy/model";
import { saveCopyPlatformSettings } from "@/lib/copy/settings";
import { SESSION_DAYS } from "@/lib/auth/token";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveAdminSettings(formData: FormData) {
  await requireAdmin();
  const days = parseCopyMinActivityDays(formData.get("copyMinActivityDays"));
  if (!days.ok) {
    redirect("/admin/settings?tab=copy&error=copy-days");
  }
  const limits = parseCopyFollowerLimits({
    defaultValue: formData.get("copyMaxFollowersDefault"),
    ceiling: formData.get("copyMaxFollowersCeiling"),
  });
  if (!limits.ok) {
    if (limits.error.includes("above")) {
      redirect("/admin/settings?tab=copy&error=copy-followers-range");
    }
    if (limits.error.includes("Platform maximum")) {
      redirect("/admin/settings?tab=copy&error=copy-followers-ceiling");
    }
    redirect("/admin/settings?tab=copy&error=copy-followers");
  }
  const savedCopy = await saveCopyPlatformSettings({
    minActivityDays: days.days,
    maxFollowersDefault: limits.maxFollowersDefault,
    maxFollowersCeiling: limits.maxFollowersCeiling,
  });
  if (!savedCopy.ok) {
    redirect("/admin/settings?tab=copy&error=copy-days");
  }
  revalidatePath("/admin/settings");
  redirect("/admin/settings?tab=copy&saved=1");
}

export async function saveEmailFromAction(formData: FormData) {
  await requireAdmin();
  const file = formData.get("platformLogo");
  const saved = await savePlatformIdentity({
    name: formData.get("platformName"),
    emailFrom: formData.get("emailFrom"),
    file: file instanceof File ? file : null,
    removeLogo: formData.get("removePlatformLogo") === "on",
  });
  if (!saved.ok) {
    const error =
      saved.field === "name"
        ? "platform-name"
        : saved.field === "platform-logo"
          ? "platform-logo"
          : "email-from";
    redirect(`/admin/settings?error=${error}`);
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/email-templates");
  redirect("/admin/settings?saved=1");
}

export async function saveAutoTickAction(formData: FormData) {
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
