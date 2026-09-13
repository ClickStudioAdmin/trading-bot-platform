"use server";

import { requireAdmin } from "@/lib/admin/access";
import { emailIsListedAdmin } from "@/lib/admin/emails";
import { hashPassword } from "@/lib/auth/password";
import { createSession, getSessionMember } from "@/lib/auth/session";
import {
  clearReferralCookie,
  readReferralCookie,
  readReferralLinkCookie,
} from "@/lib/membership/affiliate-cookie";
import { parseAffiliateSignup } from "@/lib/members/form";
import { writeEventLog } from "@/lib/logs/write";
import { AFFILIATES_PATH, WELCOME_PATH } from "@/lib/auth/onboarding-path";
import {
  AFFILIATE_PAYOUT_COIN,
  affiliatePortalPath,
  parseAffiliateCookieDays,
  parseAffiliateHoldDays,
  parseAffiliateMaxDepth,
  parseAffiliateMinPayout,
  parseDowngradeGraceDays,
  parsePayoutAddress,
  parsePayoutNetwork,
  parseProgramDefaultRates,
  withdrawDecision,
  type AffiliatePortalTab,
} from "./affiliate";
import { listAffiliatePayoutChains } from "./wallet-store";
import { parseUuid } from "./wallet-form";
import {
  approvePayout,
  listPayableCommissions,
  loadAffiliateSettings,
  loadMemberArrears,
  markPayoutPaid,
  rejectPayout,
  releaseDueCommissions,
  requestUsdtPayout,
  attributeReferral,
  createAffiliateCampaign,
  createAffiliateLink,
  ensureReferralCode,
  findReferralCodeOwner,
  saveAffiliateSettings,
} from "./affiliate-store";
import { getDefaultMembershipPlan } from "./store";
import { createServiceClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function adminFail(error: string): never {
  redirect(`/admin/affiliates?error=${encodeURIComponent(error)}`);
}

function settingsFail(error: string): never {
  redirect(
    `/admin/settings?tab=affiliates&error=${encodeURIComponent(error)}`,
  );
}

function portalFail(
  error: string,
  tab: AffiliatePortalTab = "overview",
): never {
  redirect(affiliatePortalPath(tab, { error }));
}

function signupFail(error: string): never {
  redirect(`${AFFILIATES_PATH}?error=${encodeURIComponent(error)}`);
}

export async function saveAffiliateSettingsAction(formData: FormData) {
  await requireAdmin();
  const depth = parseAffiliateMaxDepth(formData.get("maxDepth"));
  if (!depth.ok) {
    settingsFail(depth.error);
  }
  const hold = parseAffiliateHoldDays(formData.get("holdDays"));
  if (!hold.ok) {
    settingsFail(hold.error);
  }
  const min = parseAffiliateMinPayout(formData.get("minPayoutUsd"));
  if (!min.ok) {
    settingsFail(min.error);
  }
  const grace = parseDowngradeGraceDays(formData.get("downgradeGraceDays"));
  if (!grace.ok) {
    settingsFail(grace.error);
  }
  const cookie = parseAffiliateCookieDays(formData.get("cookieDays"));
  if (!cookie.ok) {
    settingsFail(cookie.error);
  }
  const rates = parseProgramDefaultRates({
    l1: formData.get("defaultL1Pct"),
    l2: formData.get("defaultL2Pct"),
    l3: formData.get("defaultL3Pct"),
    l4: formData.get("defaultL4Pct"),
    l5: formData.get("defaultL5Pct"),
  });
  if (!rates.ok) {
    settingsFail(rates.error);
  }
  const saved = await saveAffiliateSettings({
    maxDepth: depth.depth,
    holdDays: hold.days,
    minPayoutUsd: min.usd,
    payoutCoin: AFFILIATE_PAYOUT_COIN,
    downgradeGraceDays: grace.days,
    cookieDays: cookie.days,
    defaultL1Pct: rates.defaultL1Pct,
    defaultL2Pct: rates.defaultL2Pct,
    defaultL3Pct: rates.defaultL3Pct,
    defaultL4Pct: rates.defaultL4Pct,
    defaultL5Pct: rates.defaultL5Pct,
  });
  if (!saved.ok) {
    settingsFail(saved.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.affiliate_settings",
    message: "Saved affiliate program settings",
    data: {
      maxDepth: depth.depth,
      holdDays: hold.days,
      minPayoutUsd: min.usd,
      cookieDays: cookie.days,
    },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/affiliates");
  revalidatePath(AFFILIATES_PATH);
  revalidatePath("/account/affiliates");
  redirect("/admin/settings?tab=affiliates&saved=1");
}

export async function approvePayoutAction(formData: FormData) {
  const admin = await requireAdmin();
  const payoutId = parseUuid(formData.get("payoutId"));
  if (!payoutId) {
    adminFail("Missing payout.");
  }
  const saved = await approvePayout(payoutId);
  if (!saved.ok) {
    adminFail(saved.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.payout_approved",
    message: "Approved an affiliate payout",
    userId: admin.id,
    data: { payoutId },
  });
  revalidatePath("/admin/affiliates");
  redirect("/admin/affiliates?saved=approved");
}

export async function rejectPayoutAction(formData: FormData) {
  const admin = await requireAdmin();
  const payoutId = parseUuid(formData.get("payoutId"));
  if (!payoutId) {
    adminFail("Missing payout.");
  }
  const saved = await rejectPayout(payoutId);
  if (!saved.ok) {
    adminFail(saved.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.payout_rejected",
    message: "Rejected an affiliate payout",
    userId: admin.id,
    data: { payoutId },
  });
  revalidatePath("/admin/affiliates");
  revalidatePath(AFFILIATES_PATH);
  revalidatePath("/account/affiliates");
  redirect("/admin/affiliates?saved=rejected");
}

export async function markPayoutPaidAction(formData: FormData) {
  const admin = await requireAdmin();
  const payoutId = parseUuid(formData.get("payoutId"));
  if (!payoutId) {
    adminFail("Missing payout.");
  }
  const externalId = String(formData.get("externalId") ?? "").trim() || null;
  const saved = await markPayoutPaid(payoutId, externalId);
  if (!saved.ok) {
    adminFail(saved.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.payout_paid",
    message: "Marked an affiliate payout paid",
    userId: admin.id,
    data: { payoutId, externalId },
  });
  revalidatePath("/admin/affiliates");
  revalidatePath(AFFILIATES_PATH);
  revalidatePath("/account/affiliates");
  redirect("/admin/affiliates?saved=paid");
}

export async function requestAffiliatePayoutAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  await releaseDueCommissions();
  const settings = await loadAffiliateSettings();
  const payoutChains = await listAffiliatePayoutChains();
  const network = parsePayoutNetwork(
    formData.get("network"),
    payoutChains.map((chain) => chain.slug),
  );
  if (!network.ok) {
    portalFail(network.error, "payouts");
  }
  const address = parsePayoutAddress(formData.get("address"));
  if (!address.ok) {
    portalFail(address.error, "payouts");
  }
  const arrears = await loadMemberArrears(member.id);
  const payable = await listPayableCommissions(member.id);
  const payableUsd = payable.reduce((sum, row) => sum + row.amountUsd, 0);
  const allowed = withdrawDecision({
    arrears,
    payableUsd,
    minPayoutUsd: settings.minPayoutUsd,
  });
  if (!allowed.ok) {
    portalFail(allowed.reason, "payouts");
  }
  const requested = await requestUsdtPayout({
    userId: member.id,
    network: network.network,
    address: address.address,
  });
  if (!requested.ok) {
    portalFail(requested.error, "payouts");
  }
  await writeEventLog({
    scope: "system",
    event: "membership.payout_requested",
    message: "Requested a USDT affiliate payout",
    userId: member.id,
    data: { payoutId: requested.payoutId, network: network.network },
  });
  revalidatePath(AFFILIATES_PATH);
  revalidatePath("/account/affiliates");
  revalidatePath("/admin/affiliates");
  redirect(affiliatePortalPath("payouts", { saved: "withdraw" }));
}

export async function signUpAffiliateAction(formData: FormData) {
  const signedIn = await getSessionMember();
  if (signedIn) {
    redirect(AFFILIATES_PATH);
  }
  const parsed = parseAffiliateSignup(formData);
  if (!parsed.ok) {
    signupFail(parsed.error);
  }
  const referralCode = parsed.referralCode ?? (await readReferralCookie());
  const linkSlug = await readReferralLinkCookie();
  if (referralCode) {
    const owner = await findReferralCodeOwner(referralCode);
    if (!owner) {
      signupFail("That referral code was not found.");
    }
  }
  const supabase = createServiceClient();
  if (!supabase) {
    signupFail("Database is not configured.");
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
    platform_member: listedAdmin,
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
      signupFail("That email already has an account. Sign in instead.");
    }
    signupFail(error.message);
  }
  if (referralCode) {
    const attributed = await attributeReferral({
      userId,
      code: referralCode,
      linkSlug,
    });
    if (!attributed.ok) {
      signupFail(attributed.error);
    }
  }
  await ensureReferralCode(userId);
  await clearReferralCookie();
  await writeEventLog({
    scope: "system",
    event: "membership.affiliate_signed_up",
    message: `Affiliate signup ${parsed.email}`,
    userId,
    data: { email: parsed.email },
  });
  await createSession(userId);
  revalidatePath(AFFILIATES_PATH);
  redirect(`${AFFILIATES_PATH}?saved=joined`);
}

export async function upgradeAffiliateToPlatformAction() {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  if (member.platformMember) {
    redirect(WELCOME_PATH);
  }
  const plan = await getDefaultMembershipPlan();
  if (!plan) {
    portalFail("The Free plan is not configured.");
  }
  const supabase = createServiceClient();
  if (!supabase) {
    portalFail("Database is not configured.");
  }
  const { error } = await supabase
    .from("members")
    .update({
      platform_member: true,
      plan_id: plan.id,
      last_enroll_plan_id: plan.id,
      subscription_status: "none",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", member.id);
  if (error) {
    portalFail(error.message);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.affiliate_upgraded",
    message: "Upgraded affiliate to platform membership",
    userId: member.id,
    data: { planId: plan.id },
  });
  revalidatePath("/", "layout");
  revalidatePath(AFFILIATES_PATH);
  redirect(WELCOME_PATH);
}

export async function createAffiliateCampaignAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const created = await createAffiliateCampaign({
    userId: member.id,
    name: formData.get("name"),
  });
  if (!created.ok) {
    portalFail(created.error, "links");
  }
  await writeEventLog({
    scope: "system",
    event: "membership.affiliate_campaign",
    message: "Created an affiliate campaign",
    userId: member.id,
    data: { campaignId: created.id },
  });
  revalidatePath(AFFILIATES_PATH);
  redirect(affiliatePortalPath("links", { saved: "campaign" }));
}

export async function createAffiliateLinkAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const campaignRaw = String(formData.get("campaignId") ?? "").trim();
  const campaignId = campaignRaw ? parseUuid(campaignRaw) : null;
  if (campaignRaw && !campaignId) {
    portalFail("Choose a campaign.", "links");
  }
  const created = await createAffiliateLink({
    userId: member.id,
    name: formData.get("name"),
    landing: formData.get("landing"),
    campaignId,
  });
  if (!created.ok) {
    portalFail(created.error, "links");
  }
  await writeEventLog({
    scope: "system",
    event: "membership.affiliate_link",
    message: "Created an affiliate link",
    userId: member.id,
    data: { slug: created.slug },
  });
  revalidatePath(AFFILIATES_PATH);
  redirect(affiliatePortalPath("links", { saved: "link" }));
}
