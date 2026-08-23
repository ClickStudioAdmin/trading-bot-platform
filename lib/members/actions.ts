"use server";

import { requireAdmin } from "@/lib/admin/access";
import { emailIsListedAdmin } from "@/lib/admin/emails";
import { ensureDefaultPaperAccount } from "@/lib/accounts/store";
import { hashPassword } from "@/lib/auth/password";
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

  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error: insertError } = await supabase.from("members").insert({
    user_id: userId,
    email: parsed.values.email,
    name: parsed.values.name,
    role: parsed.values.role,
    status: parsed.values.status,
    password_hash: hashPassword(parsed.values.password),
    created_at: now,
    updated_at: now,
  });

  if (insertError) {
    redirect(`/admin/members/new?error=${encodeURIComponent(insertError.message)}`);
  }

  await ensureDefaultPaperAccount(userId);

  await writeEventLog({
    scope: "system",
    event: "member.created",
    message: `Created member ${parsed.values.email}`,
    userId: admin.id,
    data: {
      memberUserId: userId,
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
    .select("id, user_id, email")
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

  const update: Record<string, unknown> = {
    email: parsed.values.email,
    name: parsed.values.name,
    role: parsed.values.role,
    status: parsed.values.status,
    updated_at: new Date().toISOString(),
  };
  if (parsed.values.password) {
    update.password_hash = hashPassword(parsed.values.password);
  }

  const { error: updateError } = await supabase
    .from("members")
    .update(update)
    .eq("id", memberId);

  if (updateError) {
    redirect(
      `/admin/members/${memberId}?error=${encodeURIComponent(updateError.message)}`,
    );
  }

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
