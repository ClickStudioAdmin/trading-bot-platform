"use server";

import { emailIsListedAdmin } from "@/lib/admin/emails";
import { createSession, clearSession, getSessionContext, getSessionMember } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { memberDisplayName } from "@/lib/members/sync";
import { createServiceClient } from "@/lib/supabase/admin";
import { deskHomePath } from "@/lib/accounts/model";
import { redirect } from "next/navigation";

async function redirectToDeskHome() {
  const session = await getSessionContext();
  redirect(session ? deskHomePath(session.account.deskType, session.account.id) : "/strategies");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) {
    redirect("/sign-in?error=Enter%20your%20email%20and%20a%20password%20of%20at%20least%208%20characters.");
  }

  const supabase = createServiceClient();
  if (!supabase) {
    redirect(
      "/sign-in?error=Set%20SUPABASE_SERVICE_ROLE_KEY%20(local%3A%20.env.local%20with%20the%20TBP-dev%20service_role%3B%20Vercel%3A%20Development%20environment.%20This%20is%20the%20database%20key%2C%20not%20Supabase%20Auth).",
    );
  }

  let existing: {
    user_id?: unknown;
    status?: unknown;
    password_hash?: unknown;
  } | null = null;
  let lookupFailed: string | null = null;
  try {
    const lookedUp = await supabase
      .from("members")
      .select("user_id, email, name, role, status, password_hash")
      .eq("email", email)
      .maybeSingle();
    if (lookedUp.error) {
      lookupFailed = lookedUp.error.message;
    } else {
      existing = lookedUp.data;
    }
  } catch (cause) {
    const raw = cause instanceof Error ? cause.message : "fetch failed";
    lookupFailed = raw.toLowerCase().includes("fetch")
      ? "Could not reach the database. SUPABASE_URL must be https://….supabase.co from TBP-dev Project Settings → API, not the Vercel host. Restart next dev after editing .env.local."
      : raw;
  }
  if (lookupFailed) {
    redirect(`/sign-in?error=${encodeURIComponent(lookupFailed)}`);
  }

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
    await redirectToDeskHome();
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
    await redirectToDeskHome();
  }

  if (!stored || !verifyPassword(password, stored)) {
    redirect("/sign-in?error=Unknown%20email%20or%20password.");
  }

  await createSession(userId);
  await redirectToDeskHome();
}

export async function signOut() {
  await clearSession();
  redirect("/sign-in");
}

export async function signedInMember() {
  return getSessionMember();
}
