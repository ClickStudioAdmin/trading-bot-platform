"use server";

import { emailIsListedAdmin } from "@/lib/admin/emails";
import { deskHomePath, pickDefaultAccount } from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import {
  AFFILIATES_PATH,
  SIGN_UP_PATH,
  WELCOME_PATH,
} from "@/lib/auth/onboarding-path";
import { createSession, clearSession, getSessionMember } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { writeEventLog } from "@/lib/logs/write";
import { parseAffiliateSignup } from "@/lib/members/form";
import { memberDisplayName } from "@/lib/members/sync";
import {
  clearReferralCookie,
  readReferralCookie,
  readReferralLinkCookie,
} from "@/lib/membership/affiliate-cookie";
import {
  attributeReferral,
  ensureReferralCode,
  findReferralCodeOwner,
} from "@/lib/membership/affiliate-store";
import { getDefaultMembershipPlan } from "@/lib/membership/store";
import { createServiceClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function redirectAfterSignIn(userId: string) {
  const member = await getSessionMember();
  if (member && !member.platformMember) {
    redirect(AFFILIATES_PATH);
  }
  const accounts = await listTradingAccounts(userId);
  if (accounts.length === 0) {
    redirect(WELCOME_PATH);
  }
  const home = pickDefaultAccount(accounts);
  redirect(home ? deskHomePath(home.deskType, home.id) : WELCOME_PATH);
}

function signUpFail(error: string): never {
  redirect(`${SIGN_UP_PATH}?error=${encodeURIComponent(error)}`);
}

export async function signUpMember(formData: FormData) {
  const signedIn = await getSessionMember();
  if (signedIn) {
    if (!signedIn.platformMember) {
      redirect(AFFILIATES_PATH);
    }
    await redirectAfterSignIn(signedIn.id);
  }
  const parsed = parseAffiliateSignup(formData);
  if (!parsed.ok) {
    signUpFail(parsed.error);
  }
  const referralCode = parsed.referralCode ?? (await readReferralCookie());
  const linkSlug = await readReferralLinkCookie();
  if (referralCode) {
    const owner = await findReferralCodeOwner(referralCode);
    if (!owner) {
      signUpFail("That referral code was not found.");
    }
  }
  const plan = await getDefaultMembershipPlan();
  if (!plan) {
    signUpFail("The Free plan is not configured.");
  }
  const supabase = createServiceClient();
  if (!supabase) {
    signUpFail("Database is not configured.");
  }
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const listedAdmin = emailIsListedAdmin(parsed.email);
  const row: Record<string, unknown> = {
    user_id: userId,
    email: parsed.email,
    name: parsed.name,
    role: listedAdmin ? "admin" : "member",
    status: "active",
    platform_member: true,
    plan_id: plan.id,
    last_enroll_plan_id: plan.id,
    subscription_status: "none",
    password_hash: hashPassword(parsed.password),
    created_at: now,
    updated_at: now,
  };
  let { error } = await supabase.from("members").insert(row);
  if (error && String(error.message).includes("platform_member")) {
    delete row.platform_member;
    const retry = await supabase.from("members").insert(row);
    error = retry.error;
  }
  if (error) {
    if (error.code === "23505") {
      signUpFail("That email already has an account. Sign in instead.");
    }
    signUpFail(error.message);
  }
  if (referralCode) {
    const attributed = await attributeReferral({
      userId,
      code: referralCode,
      linkSlug,
    });
    if (!attributed.ok) {
      signUpFail(attributed.error);
    }
  }
  await ensureReferralCode(userId);
  await clearReferralCookie();
  await writeEventLog({
    scope: "system",
    event: "member.signed_up",
    message: `Public signup ${parsed.email}`,
    userId,
    data: { email: parsed.email, planId: plan.id },
  });
  await createSession(userId);
  revalidatePath("/", "layout");
  redirect(WELCOME_PATH);
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
    await redirectAfterSignIn(userId);
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
    await redirectAfterSignIn(userId);
  }

  if (!stored || !verifyPassword(password, stored)) {
    redirect("/sign-in?error=Unknown%20email%20or%20password.");
  }

  await createSession(userId);
  await redirectAfterSignIn(userId);
}

export async function signOut() {
  await clearSession();
  redirect("/sign-in");
}

export async function signedInMember() {
  return getSessionMember();
}
