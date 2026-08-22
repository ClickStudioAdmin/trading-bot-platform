"use server";

import { emailIsListedAdmin } from "@/lib/admin/emails";
import { createSession, clearSession, getSessionMember } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { memberDisplayName } from "@/lib/members/sync";
import { createServiceClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) {
    redirect("/sign-in?error=Enter%20your%20email%20and%20a%20password%20of%20at%20least%208%20characters.");
  }

  const supabase = createServiceClient();
  if (!supabase) {
    redirect(
      "/sign-in?error=Set%20SUPABASE_SERVICE_ROLE_KEY%20on%20this%20environment.",
    );
  }

  const { data: existing } = await supabase
    .from("members")
    .select("user_id, email, name, role, status, password_hash")
    .eq("email", email)
    .maybeSingle();

  let userId = existing ? String(existing.user_id) : "";

  if (!existing && emailIsListedAdmin(email)) {
    userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const { error } = await supabase.from("members").insert({
      user_id: userId,
      email,
      name: memberDisplayName(email),
      role: "admin",
      status: "active",
      password_hash: hashPassword(password),
      created_at: now,
      updated_at: now,
    });
    if (error) {
      redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
    }
    await createSession(userId);
    redirect("/strategies/cash-and-carry");
  }

  if (!existing) {
    redirect("/sign-in?error=Unknown%20email%20or%20password.");
  }
  if (existing.status === "disabled") {
    redirect("/sign-in?error=This%20account%20is%20disabled.");
  }

  const stored = existing.password_hash ? String(existing.password_hash) : "";
  if (!stored && emailIsListedAdmin(email)) {
    const { error } = await supabase
      .from("members")
      .update({
        password_hash: hashPassword(password),
        role: "admin",
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (error) {
      redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
    }
    await createSession(userId);
    redirect("/strategies/cash-and-carry");
  }

  if (!stored || !verifyPassword(password, stored)) {
    redirect("/sign-in?error=Unknown%20email%20or%20password.");
  }

  await createSession(userId);
  redirect("/strategies/cash-and-carry");
}

export async function signOut() {
  await clearSession();
  redirect("/sign-in");
}

export async function signedInMember() {
  return getSessionMember();
}
