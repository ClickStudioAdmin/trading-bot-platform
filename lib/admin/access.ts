import { emailIsListedAdmin } from "@/lib/admin/emails";
import { ensureMemberRow } from "@/lib/members/sync";
import { createServiceClient } from "@/lib/supabase/admin";
import { createUserClient, getAuthUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type AdminUser = {
  id: string;
  email: string | null;
};

export { emailIsListedAdmin, listedAdminEmails } from "@/lib/admin/emails";

export async function getAdminUser(): Promise<AdminUser | null> {
  const user = await getAuthUser();
  if (!user) {
    return null;
  }

  if (emailIsListedAdmin(user.email)) {
    await ensureAdminRow(user.id);
    await ensureMemberRow({
      userId: user.id,
      email: user.email ?? null,
    });
    return { id: user.id, email: user.email ?? null };
  }

  const supabase = await createUserClient();
  if (!supabase) {
    return null;
  }

  const { data: member } = await supabase
    .from("members")
    .select("role, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (member?.status === "disabled") {
    return null;
  }
  if (member?.role === "admin") {
    await ensureAdminRow(user.id);
    return { id: user.id, email: user.email ?? null };
  }

  const { data } = await supabase
    .from("app_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return data ? { id: user.id, email: user.email ?? null } : null;
}

export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAuthUser();
  if (!user) {
    redirect("/sign-in");
  }
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/strategies");
  }
  return admin;
}

async function ensureAdminRow(userId: string): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  await supabase.from("app_admins").upsert({ user_id: userId });
}
