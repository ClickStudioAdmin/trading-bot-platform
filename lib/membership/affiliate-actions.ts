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
  parseAutoPayoutUsd,
  parseDowngradeGraceDays,
  parsePayoutAddress,
  parsePayoutAmount,
  withdrawAmountDecision,
  parsePayoutNetwork,
  parseProgramDefaultRates,
  withdrawDecision,
  parseAffiliateAlias,
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
  maybeAutoAffiliatePayout,
  saveAffiliatePayoutSettings,
  archiveAffiliateCampaign,
  archiveAffiliateLink,
  renameAffiliateLink,
  attributeReferral,
  createAffiliateCampaign,
  createAffiliateLink,
  ensureReferralCode,
  findReferralCodeOwner,
  saveAffiliateAlias,
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
  const amount = parsePayoutAmount(formData.get("amountUsd"));
  if (!amount.ok) {
    portalFail(amount.error, "payouts");
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
  const amountOk = withdrawAmountDecision({
    payableUsd,
    minPayoutUsd: settings.minPayoutUsd,
    amountUsd: amount.amountUsd,
  });
  if (!amountOk.ok) {
    portalFail(amountOk.reason, "payouts");
  }
  const requested = await requestUsdtPayout({
    userId: member.id,
    network: network.network,
    address: address.address,
    amountUsd: amount.amountUsd,
  });
  if (!requested.ok) {
    portalFail(requested.error, "payouts");
  }
  await writeEventLog({
    scope: "system",
    event: "membership.payout_requested",
    message: "Requested a USDT affiliate payout",
    userId: member.id,
    data: {
      payoutId: requested.payoutId,
      network: network.network,
      amountUsd: amount.amountUsd,
    },
  });
  revalidatePath(AFFILIATES_PATH);
  revalidatePath("/account/affiliates");
  revalidatePath("/admin/affiliates");
  redirect(affiliatePortalPath("payouts", { saved: "withdraw" }));
}

export async function saveAffiliatePayoutSettingsAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const payoutChains = await listAffiliatePayoutChains();
  const network = parsePayoutNetwork(
    formData.get("network"),
    payoutChains.map((chain) => chain.slug),
  );
  if (!network.ok) {
    portalFail(network.error, "settings");
  }
  const address = parsePayoutAddress(formData.get("address"));
  if (!address.ok) {
    portalFail(address.error, "settings");
  }
  const autoPayout = String(formData.get("autoPayout") ?? "") === "1";
  const settings = await loadAffiliateSettings();
  let autoPayoutUsd: number | null = null;
  if (autoPayout) {
    const parsed = parseAutoPayoutUsd(
      formData.get("autoPayoutUsd"),
      settings.minPayoutUsd,
    );
    if (!parsed.ok) {
      portalFail(parsed.error, "settings");
    }
    autoPayoutUsd = parsed.usd;
  }
  const saved = await saveAffiliatePayoutSettings({
    userId: member.id,
    network: network.network,
    address: address.address,
    autoPayout,
    autoPayoutUsd,
  });
  if (!saved.ok) {
    portalFail(saved.error, "settings");
  }
  if (autoPayout) {
    await maybeAutoAffiliatePayout(member.id);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.payout_settings",
    message: "Saved affiliate payout settings",
    userId: member.id,
    data: { network: network.network, autoPayout, autoPayoutUsd },
  });
  revalidatePath(AFFILIATES_PATH);
  revalidatePath("/account/affiliates");
  redirect(affiliatePortalPath("settings", { saved: "payout-settings" }));
}

export async function saveAffiliateAliasAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const parsed = parseAffiliateAlias(formData.get("alias"));
  if (!parsed.ok) {
    portalFail(parsed.error, "settings");
  }
  const saved = await saveAffiliateAlias({
    userId: member.id,
    alias: parsed.alias,
  });
  if (!saved.ok) {
    portalFail(saved.error, "settings");
  }
  await writeEventLog({
    scope: "system",
    event: "membership.affiliate_alias",
    message: "Saved affiliate alias",
    userId: member.id,
    data: { alias: parsed.alias },
  });
  revalidatePath(AFFILIATES_PATH);
  revalidatePath("/account/affiliates");
  redirect(affiliatePortalPath("settings", { saved: "alias" }));
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
    portalFail(created.error, "campaigns");
  }
  await writeEventLog({
    scope: "system",
    event: "membership.affiliate_campaign",
    message: "Created an affiliate campaign",
    userId: member.id,
    data: { campaignId: created.id },
  });
  revalidatePath(AFFILIATES_PATH);
  redirect(affiliatePortalPath("campaigns", { saved: "campaign" }));
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

export async function archiveAffiliateCampaignAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const campaignId = parseUuid(formData.get("campaignId"));
  if (!campaignId) {
    portalFail("Choose a campaign.", "campaigns");
  }
  const archived = await archiveAffiliateCampaign({
    userId: member.id,
    campaignId,
  });
  if (!archived.ok) {
    portalFail(archived.error, "campaigns");
  }
  await writeEventLog({
    scope: "system",
    event: "membership.affiliate_campaign_archived",
    message: "Archived an affiliate campaign",
    userId: member.id,
    data: { campaignId },
  });
  revalidatePath(AFFILIATES_PATH);
  redirect(affiliatePortalPath("campaigns", { saved: "campaign-archived" }));
}

export async function archiveAffiliateLinkAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const linkId = parseUuid(formData.get("linkId"));
  if (!linkId) {
    portalFail("That link was not found.", "links");
  }
  const archived = await archiveAffiliateLink({
    userId: member.id,
    linkId,
  });
  if (!archived.ok) {
    portalFail(archived.error, "links");
  }
  await writeEventLog({
    scope: "system",
    event: "membership.affiliate_link_archived",
    message: "Archived an affiliate link",
    userId: member.id,
    data: { linkId },
  });
  revalidatePath(AFFILIATES_PATH);
  redirect(affiliatePortalPath("links", { saved: "link-archived" }));
}

export async function renameAffiliateLinkAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const linkId = parseUuid(formData.get("linkId"));
  if (!linkId) {
    portalFail("That link was not found.", "links");
  }
  const renamed = await renameAffiliateLink({
    userId: member.id,
    linkId,
    name: formData.get("name"),
  });
  if (!renamed.ok) {
    portalFail(renamed.error, "links");
  }
  await writeEventLog({
    scope: "system",
    event: "membership.affiliate_link_renamed",
    message: "Renamed an affiliate link",
    userId: member.id,
    data: { linkId },
  });
  revalidatePath(AFFILIATES_PATH);
  redirect(affiliatePortalPath("links", { saved: "link-renamed" }));
}
