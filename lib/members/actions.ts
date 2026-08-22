"use server";

import { requireAdmin } from "@/lib/admin/access";
import { emailIsListedAdmin } from "@/lib/admin/emails";
import { writeEventLog } from "@/lib/logs/write";
import { parseMemberForm, parseMemberId } from "@/lib/members/form";
import { createServiceClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function createMember(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = parseMemberForm(formData, "create");
  if (!parsed.ok) {
    redirect(`/admin/members/new?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = createServiceClient();
  if (!supabase) {
    redirect(
      `/admin/members/new?error=${encodeURIComponent("Service role is not configured.")}`,
    );
  }

  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.values.email,
    password: parsed.values.password,
    email_confirm: true,
    user_metadata: { name: parsed.values.name },
  });

  if (authError || !created.user) {
    redirect(
      `/admin/members/new?error=${encodeURIComponent(authError?.message ?? "Could not create the sign-in user.")}`,
    );
  }

  const now = new Date().toISOString();
  const { error: insertError } = await supabase.from("members").insert({
    user_id: created.user.id,
    email: parsed.values.email,
    name: parsed.values.name,
    role: parsed.values.role,
    status: parsed.values.status,
    created_at: now,
    updated_at: now,
  });

  if (insertError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    redirect(`/admin/members/new?error=${encodeURIComponent(insertError.message)}`);
  }

  await syncAdminRow(supabase, created.user.id, parsed.values.role);
  await applyAuthStatus(supabase, created.user.id, parsed.values.status);

  await writeEventLog({
    scope: "system",
    event: "member.created",
    message: `Created member ${parsed.values.email}`,
    userId: admin.id,
    data: {
      memberUserId: created.user.id,
      email: parsed.values.email,
      role: parsed.values.role,
      status: parsed.values.status,
    },
  });

  redirect("/admin/members?created=1");
}

export async function updateMember(formData: FormData) {
  const admin = await requireAdmin();
  const memberId = parseMemberId(String(formData.get("memberId") ?? ""));
  if (memberId === null) {
    redirect(`/admin/members?error=${encodeURIComponent("Missing member.")}`);
  }

  const parsed = parseMemberForm(formData, "edit");
  if (!parsed.ok) {
    redirect(
      `/admin/members/${memberId}?error=${encodeURIComponent(parsed.error)}`,
    );
  }

  const supabase = createServiceClient();
  if (!supabase) {
    redirect(
      `/admin/members/${memberId}?error=${encodeURIComponent("Service role is not configured.")}`,
    );
  }

  const { data: existing, error: loadError } = await supabase
    .from("members")
    .select("*")
    .eq("id", memberId)
    .maybeSingle();

  if (loadError || !existing) {
    redirect(`/admin/members?error=${encodeURIComponent("That member was not found.")}`);
  }

  const userId = String(existing.user_id);
  if (emailIsListedAdmin(String(existing.email))) {
    parsed.values.email = String(existing.email).toLowerCase();
    parsed.values.role = "admin";
    parsed.values.status = "active";
  }
  if (userId === admin.id && parsed.values.status === "disabled") {
    redirect(
      `/admin/members/${memberId}?error=${encodeURIComponent("You cannot disable your own account.")}`,
    );
  }

  const authPatch: {
    email: string;
    user_metadata: { name: string };
    password?: string;
  } = {
    email: parsed.values.email,
    user_metadata: { name: parsed.values.name },
  };
  if (parsed.values.password) {
    authPatch.password = parsed.values.password;
  }

  const { error: authError } = await supabase.auth.admin.updateUserById(
    userId,
    authPatch,
  );
  if (authError) {
    redirect(
      `/admin/members/${memberId}?error=${encodeURIComponent(authError.message)}`,
    );
  }

  const { error: updateError } = await supabase
    .from("members")
    .update({
      email: parsed.values.email,
      name: parsed.values.name,
      role: parsed.values.role,
      status: parsed.values.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);

  if (updateError) {
    redirect(
      `/admin/members/${memberId}?error=${encodeURIComponent(updateError.message)}`,
    );
  }

  await syncAdminRow(supabase, userId, parsed.values.role);
  await applyAuthStatus(supabase, userId, parsed.values.status);

  await writeEventLog({
    scope: "system",
    event: "member.updated",
    message: `Updated member ${parsed.values.email}`,
    userId: admin.id,
    data: {
      memberId,
      memberUserId: userId,
      email: parsed.values.email,
      role: parsed.values.role,
      status: parsed.values.status,
    },
  });

  redirect("/admin/members?updated=1");
}

async function syncAdminRow(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  userId: string,
  role: "member" | "admin",
) {
  if (role === "admin") {
    await supabase.from("app_admins").upsert({ user_id: userId });
    return;
  }
  await supabase.from("app_admins").delete().eq("user_id", userId);
}

async function applyAuthStatus(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  userId: string,
  status: "active" | "disabled",
) {
  await supabase.auth.admin.updateUserById(userId, {
    ban_duration: status === "disabled" ? "876000h" : "none",
  });
}
