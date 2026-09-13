import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  AFFILIATE_CAMPAIGN_MAX,
  AFFILIATE_CAMPAIGN_NAME_MAX,
  AFFILIATE_LINK_MAX,
  AFFILIATE_LINK_NAME_MAX,
  AFFILIATE_LINK_SLUG_MAX,
  EMPTY_AFFILIATE_SETTINGS,
  affiliateRateKeyForLevel,
  canCreateCommissionInvoice,
  commissionUsd,
  generateAffiliateLinkSlug,
  generateReferralCode,
  holdUntilIso,
  parseAffiliateCookieDays,
  parseAffiliateHoldDays,
  parseAffiliateLabel,
  parseAffiliateLanding,
  parseAffiliateLinkSlug,
  parseAffiliateMaxDepth,
  parseAffiliateMinPayout,
  parseCommissionStatus,
  parseDowngradeGraceDays,
  parsePayoutMethod,
  parsePayoutStatus,
  parseAffiliateRatePct,
  parseReferralCode,
  programDefaultRates,
  ratePctForLevel,
  resolveEarnDepth,
  affiliateRateSource,
  unpaidUsesProgramAffiliateRates,
  walkUpline,
  wouldCreateReferralCycle,
  type AffiliateLanding,
  type AffiliateProgramSettings,
  type CommissionStatus,
  type PayoutStatus,
} from "./affiliate";
import { planAffiliateRate, type MembershipPlan } from "./catalog";
import {
  getMembershipPlan,
  listMembershipPlans,
} from "./store";
import { rememberAffiliateCookieDays } from "./affiliate-cookie-days";
import { roundUsd } from "./wallet";

export type ReferralRecord = {
  userId: string;
  referrerUserId: string;
  code: string;
  attributedAt: string;
  firstPaidAt: string | null;
};

export type CommissionRow = {
  id: string;
  earnerUserId: string;
  sourceUserId: string;
  invoiceId: string;
  ratePlanId: string | null;
  campaignId: string | null;
  linkId: string | null;
  level: number;
  ratePct: number;
  amountUsd: number;
  status: CommissionStatus;
  holdUntil: string;
  createdAt: string;
};

export type PayoutRow = {
  id: string;
  userId: string;
  method: "export" | "stripe_connect" | "usdt";
  amountUsd: number;
  status: PayoutStatus;
  network: string | null;
  address: string | null;
  externalId: string | null;
  createdAt: string;
  paidAt: string | null;
  email?: string;
};

export type DownlineRow = {
  userId: string;
  level: number;
  label: string;
  email?: string;
  attributedAt: string;
  firstPaidAt: string | null;
  planPriceUsd: number;
  campaignId: string | null;
  linkId: string | null;
};

export type AffiliateRateRow = {
  level: number;
  ratePct: number;
  active: boolean;
};

export type AffiliateRateCard = {
  source: "plan" | "program";
  planName: string | null;
  earnDepth: number;
  rows: AffiliateRateRow[];
};

export type AffiliateCampaignRow = {
  id: string;
  name: string;
  createdAt: string;
};

export type AffiliateLinkRow = {
  id: string;
  campaignId: string | null;
  campaignName: string | null;
  slug: string;
  name: string;
  landing: AffiliateLanding;
  createdAt: string;
  attributed: number;
};

export type PublicAffiliateLink = {
  id: string;
  userId: string;
  campaignId: string | null;
  slug: string;
  landing: AffiliateLanding;
  code: string;
};

export type AffiliatePortal = {
  code: string | null;
  settings: AffiliateProgramSettings;
  rates: AffiliateRateCard;
  payableUsd: number;
  pendingUsd: number;
  paidOutUsd: number;
  lastPayoutAt: string | null;
  downline: DownlineRow[];
  tree: AffiliateTreeNode[];
  commissions: CommissionRow[];
  campaigns: AffiliateCampaignRow[];
  links: AffiliateLinkRow[];
  stats: {
    attributed: number;
    paid: number;
    conversionPct: number;
    activePaid: number;
    countsByLevel: number[];
    referredMrrUsd: number;
    earnedPeriodUsd: number;
    earnedAllUsd: number;
  };
};

export type AffiliateTreeNode = {
  userId: string;
  label: string;
  level: number;
  paid: boolean;
  children: AffiliateTreeNode[];
};

function schemaGap(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    /does not exist/i.test(error.message ?? "")
  );
}

function optionalId(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function mapSettings(row: Record<string, unknown>): AffiliateProgramSettings {
  const depth = parseAffiliateMaxDepth(row.affiliate_max_depth);
  const hold = parseAffiliateHoldDays(row.affiliate_hold_days);
  const min = parseAffiliateMinPayout(row.affiliate_min_payout_usd);
  const grace = parseDowngradeGraceDays(row.downgrade_grace_days);
  const cookie = parseAffiliateCookieDays(row.affiliate_cookie_days);
  const l1 = parseAffiliateRatePct(row.affiliate_default_l1_pct);
  const l2 = parseAffiliateRatePct(row.affiliate_default_l2_pct);
  const l3 = parseAffiliateRatePct(row.affiliate_default_l3_pct);
  const l4 = parseAffiliateRatePct(row.affiliate_default_l4_pct);
  const l5 = parseAffiliateRatePct(row.affiliate_default_l5_pct);
  return {
    maxDepth: depth.ok ? depth.depth : EMPTY_AFFILIATE_SETTINGS.maxDepth,
    holdDays: hold.ok ? hold.days : EMPTY_AFFILIATE_SETTINGS.holdDays,
    minPayoutUsd: min.ok ? min.usd : EMPTY_AFFILIATE_SETTINGS.minPayoutUsd,
    payoutCoin:
      typeof row.affiliate_payout_coin === "string" && row.affiliate_payout_coin
        ? row.affiliate_payout_coin
        : EMPTY_AFFILIATE_SETTINGS.payoutCoin,
    downgradeGraceDays: grace.ok
      ? grace.days
      : EMPTY_AFFILIATE_SETTINGS.downgradeGraceDays,
    cookieDays: cookie.ok ? cookie.days : EMPTY_AFFILIATE_SETTINGS.cookieDays,
    defaultL1Pct: l1.ok ? l1.pct : EMPTY_AFFILIATE_SETTINGS.defaultL1Pct,
    defaultL2Pct: l2.ok ? l2.pct : EMPTY_AFFILIATE_SETTINGS.defaultL2Pct,
    defaultL3Pct: l3.ok ? l3.pct : EMPTY_AFFILIATE_SETTINGS.defaultL3Pct,
    defaultL4Pct: l4.ok ? l4.pct : EMPTY_AFFILIATE_SETTINGS.defaultL4Pct,
    defaultL5Pct: l5.ok ? l5.pct : EMPTY_AFFILIATE_SETTINGS.defaultL5Pct,
  };
}

const SETTINGS_COLUMNS =
  "affiliate_max_depth, affiliate_hold_days, affiliate_min_payout_usd, affiliate_payout_coin, downgrade_grace_days";
const SETTINGS_COLUMNS_RATES = `${SETTINGS_COLUMNS}, affiliate_default_l1_pct, affiliate_default_l2_pct, affiliate_default_l3_pct, affiliate_default_l4_pct, affiliate_default_l5_pct`;
const SETTINGS_COLUMNS_FULL = `${SETTINGS_COLUMNS_RATES}, affiliate_cookie_days`;

export async function loadAffiliateSettings(): Promise<AffiliateProgramSettings> {
  const supabase = createServiceClient();
  if (!supabase) {
    return EMPTY_AFFILIATE_SETTINGS;
  }
  const full = await supabase
    .from("platform_settings")
    .select(SETTINGS_COLUMNS_FULL)
    .eq("id", "tbp")
    .maybeSingle();
  if (!full.error && full.data) {
    return rememberSettings(mapSettings(full.data as Record<string, unknown>));
  }
  const rates = await supabase
    .from("platform_settings")
    .select(SETTINGS_COLUMNS_RATES)
    .eq("id", "tbp")
    .maybeSingle();
  if (!rates.error && rates.data) {
    return rememberSettings(mapSettings(rates.data as Record<string, unknown>));
  }
  const core = await supabase
    .from("platform_settings")
    .select(SETTINGS_COLUMNS)
    .eq("id", "tbp")
    .maybeSingle();
  if (core.error || !core.data) {
    return EMPTY_AFFILIATE_SETTINGS;
  }
  return rememberSettings(mapSettings(core.data as Record<string, unknown>));
}

function rememberSettings(
  settings: AffiliateProgramSettings,
): AffiliateProgramSettings {
  rememberAffiliateCookieDays(settings.cookieDays);
  return settings;
}

export async function saveAffiliateSettings(
  input: AffiliateProgramSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const row: Record<string, unknown> = {
    id: "tbp",
    affiliate_max_depth: input.maxDepth,
    affiliate_hold_days: input.holdDays,
    affiliate_min_payout_usd: input.minPayoutUsd,
    affiliate_payout_coin: input.payoutCoin,
    downgrade_grace_days: input.downgradeGraceDays,
    affiliate_cookie_days: input.cookieDays,
    affiliate_default_l1_pct: input.defaultL1Pct,
    affiliate_default_l2_pct: input.defaultL2Pct,
    affiliate_default_l3_pct: input.defaultL3Pct,
    affiliate_default_l4_pct: input.defaultL4Pct,
    affiliate_default_l5_pct: input.defaultL5Pct,
    updated_at: new Date().toISOString(),
  };
  let { error } = await supabase.from("platform_settings").upsert(row);
  if (error && String(error.message).includes("affiliate_cookie_days")) {
    delete row.affiliate_cookie_days;
    const retryCookie = await supabase.from("platform_settings").upsert(row);
    error = retryCookie.error;
  }
  if (error) {
    delete row.affiliate_default_l1_pct;
    delete row.affiliate_default_l2_pct;
    delete row.affiliate_default_l3_pct;
    delete row.affiliate_default_l4_pct;
    delete row.affiliate_default_l5_pct;
    delete row.affiliate_cookie_days;
    const retry = await supabase.from("platform_settings").upsert(row);
    error = retry.error;
  }
  if (error) {
    return { ok: false, error: "Could not save affiliate settings." };
  }
  rememberAffiliateCookieDays(input.cookieDays);
  return { ok: true };
}

export async function getReferralCode(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data } = await supabase
    .from("membership_referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();
  return typeof data?.code === "string" ? data.code : null;
}

export async function ensureReferralCode(
  userId: string,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const existing = await getReferralCode(userId);
  if (existing) {
    return { ok: true, code: existing };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateReferralCode(randomBytes(8));
    const { error } = await supabase.from("membership_referral_codes").insert({
      user_id: userId,
      code,
    });
    if (!error) {
      return { ok: true, code };
    }
    if (error.code !== "23505") {
      return { ok: false, error: error.message };
    }
  }
  return { ok: false, error: "Could not allocate a referral code." };
}

export async function findReferralCodeOwner(
  code: string,
): Promise<{ userId: string; code: string } | null> {
  const parsed = parseReferralCode(code);
  if (!parsed.ok) {
    return null;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data } = await supabase
    .from("membership_referral_codes")
    .select("user_id, code")
    .ilike("code", parsed.code)
    .maybeSingle();
  if (!data) {
    return null;
  }
  return { userId: String(data.user_id), code: String(data.code) };
}

async function listReferralHops(): Promise<
  Array<{ userId: string; referrerUserId: string }>
> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data } = await supabase
    .from("membership_referrals")
    .select("user_id, referrer_user_id");
  return (data ?? []).map((row) => ({
    userId: String(row.user_id),
    referrerUserId: String(row.referrer_user_id),
  }));
}

export async function attributeReferral(input: {
  userId: string;
  code: string;
  linkSlug?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const owner = await findReferralCodeOwner(input.code);
  if (!owner) {
    return { ok: false, error: "That referral code was not found." };
  }
  if (owner.userId === input.userId) {
    return { ok: false, error: "You cannot refer yourself." };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data: existing } = await supabase
    .from("membership_referrals")
    .select("user_id")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (existing) {
    return { ok: true };
  }
  const hops = await listReferralHops();
  if (wouldCreateReferralCycle(hops, input.userId, owner.userId)) {
    return { ok: false, error: "That referral would create a cycle." };
  }
  const link = input.linkSlug
    ? await findOwnedAffiliateLink(owner.userId, input.linkSlug)
    : null;
  const payload: Record<string, unknown> = {
    user_id: input.userId,
    referrer_user_id: owner.userId,
    code: owner.code,
  };
  if (link) {
    payload.campaign_id = link.campaignId;
    payload.link_id = link.id;
  }
  let { error } = await supabase.from("membership_referrals").insert(payload);
  if (error && schemaGap(error) && link) {
    delete payload.campaign_id;
    delete payload.link_id;
    const retry = await supabase.from("membership_referrals").insert(payload);
    error = retry.error;
  }
  if (error) {
    if (error.code === "23505") {
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function markReferralFirstPaid(userId: string): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  await supabase
    .from("membership_referrals")
    .update({ first_paid_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("first_paid_at", null);
}

function planRates(plan: MembershipPlan): number[] {
  return [1, 2, 3, 4, 5].map((level) => {
    const key = affiliateRateKeyForLevel(level);
    return key ? planAffiliateRate(plan, key) : 0;
  });
}

export type EarnerRateResolution = {
  source: "plan" | "program";
  rates: number[];
  planId: string | null;
  planName: string | null;
  planCap: number | null;
};

async function resolveEarnerRates(
  earnerUserId: string,
  settings: AffiliateProgramSettings,
): Promise<EarnerRateResolution | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  let { data } = await supabase
    .from("members")
    .select("plan_id, subscription_status, platform_member")
    .eq("user_id", earnerUserId)
    .maybeSingle();
  if (!data) {
    const retry = await supabase
      .from("members")
      .select("plan_id, subscription_status")
      .eq("user_id", earnerUserId)
      .maybeSingle();
    data = retry.data
      ? { ...retry.data, platform_member: true }
      : null;
  }
  if (!data) {
    return null;
  }
  const source = affiliateRateSource({
    platformMember: data.platform_member !== false,
    pastDue: unpaidUsesProgramAffiliateRates(
      String(data.subscription_status ?? ""),
    ),
  });
  if (source === "program") {
    return {
      source,
      rates: programDefaultRates(settings),
      planId: null,
      planName: null,
      planCap: null,
    };
  }
  const current = await getMembershipPlan(String(data.plan_id));
  if (!current.ok) {
    return {
      source: "program",
      rates: programDefaultRates(settings),
      planId: null,
      planName: null,
      planCap: null,
    };
  }
  return {
    source,
    rates: planRates(current.plan),
    planId: current.plan.id,
    planName: current.plan.name,
    planCap: current.plan.caps.affiliate_max_depth,
  };
}

export async function createCommissionsForInvoice(input: {
  invoiceId: string;
  sourceUserId: string;
  method: string;
  status: string;
  amountUsd: number;
  nowMs?: number;
}): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  if (
    !canCreateCommissionInvoice({
      method: input.method,
      status: input.status,
      amountUsd: input.amountUsd,
    })
  ) {
    return { ok: true, created: 0 };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const [settings, hops, attribution] = await Promise.all([
    loadAffiliateSettings(),
    listReferralHops(),
    loadReferralAttribution(input.sourceUserId),
  ]);
  const path = walkUpline(hops, input.sourceUserId, settings.maxDepth);
  const now = input.nowMs ?? Date.now();
  const holdUntil = holdUntilIso(now, settings.holdDays);
  let created = 0;
  for (const hop of path) {
    const resolved = await resolveEarnerRates(hop.earnerUserId, settings);
    if (!resolved) {
      continue;
    }
    const earnDepth = resolveEarnDepth(settings.maxDepth, resolved.planCap);
    const ratePct = ratePctForLevel(resolved.rates, hop.level, earnDepth);
    const amountUsd = commissionUsd(input.amountUsd, ratePct);
    if (amountUsd < 0.01) {
      continue;
    }
    const payload: Record<string, unknown> = {
      earner_user_id: hop.earnerUserId,
      source_user_id: input.sourceUserId,
      invoice_id: input.invoiceId,
      rate_plan_id: resolved.planId,
      level: hop.level,
      rate_pct: ratePct,
      amount_usd: amountUsd,
      status: "pending",
      hold_until: holdUntil,
    };
    if (attribution.campaignId) {
      payload.campaign_id = attribution.campaignId;
    }
    if (attribution.linkId) {
      payload.link_id = attribution.linkId;
    }
    let { error } = await supabase.from("membership_commissions").insert(payload);
    if (error && schemaGap(error)) {
      delete payload.campaign_id;
      delete payload.link_id;
      const retry = await supabase.from("membership_commissions").insert(payload);
      error = retry.error;
    }
    if (!error) {
      created += 1;
    } else if (error.code !== "23505") {
      return { ok: false, error: error.message };
    }
  }
  await markReferralFirstPaid(input.sourceUserId);
  const released = await releaseDueCommissions(now);
  if (!released.ok) {
    return released;
  }
  return { ok: true, created };
}

export async function releaseDueCommissions(
  nowMs = Date.now(),
): Promise<{ ok: true; released: number } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data, error } = await supabase
    .from("membership_commissions")
    .select("id, earner_user_id, amount_usd, level")
    .eq("status", "pending")
    .lte("hold_until", new Date(nowMs).toISOString());
  if (error) {
    return { ok: false, error: error.message };
  }
  let released = 0;
  for (const row of data ?? []) {
    const id = String(row.id);
    const amountUsd = Number(row.amount_usd);
    const externalId = `commission:${id}`;
    const { data: existing } = await supabase
      .from("membership_wallet_entries")
      .select("id")
      .eq("external_id", externalId)
      .maybeSingle();
    if (!existing) {
      const { error: walletError } = await supabase
        .from("membership_wallet_entries")
        .insert({
          user_id: String(row.earner_user_id),
          book: "affiliate",
          kind: "commission",
          amount_usd: amountUsd,
          external_id: externalId,
          memo: `L${row.level} commission`,
        });
      if (walletError && walletError.code !== "23505") {
        return { ok: false, error: walletError.message };
      }
    }
    const { error: updateError } = await supabase
      .from("membership_commissions")
      .update({ status: "payable" })
      .eq("id", id)
      .eq("status", "pending");
    if (updateError) {
      return { ok: false, error: updateError.message };
    }
    released += 1;
  }
  return { ok: true, released };
}

export async function voidPendingCommissionsForInvoice(
  invoiceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase
    .from("membership_commissions")
    .update({ status: "void" })
    .eq("invoice_id", invoiceId)
    .eq("status", "pending");
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function listQueuedCommissionIds(): Promise<Set<string>> {
  const supabase = createServiceClient();
  const queued = new Set<string>();
  if (!supabase) {
    return queued;
  }
  const { data } = await supabase
    .from("membership_payout_items")
    .select("commission_id");
  for (const row of data ?? []) {
    queued.add(String(row.commission_id));
  }
  return queued;
}

export async function listPayableCommissions(
  userId: string,
): Promise<CommissionRow[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const queued = await listQueuedCommissionIds();
  const { data, error } = await supabase
    .from("membership_commissions")
    .select(
      "id, earner_user_id, source_user_id, invoice_id, rate_plan_id, campaign_id, link_id, level, rate_pct, amount_usd, status, hold_until, created_at",
    )
    .eq("earner_user_id", userId)
    .eq("status", "payable")
    .order("created_at", { ascending: true });
  const rows = error && schemaGap(error)
    ? (
        await supabase
          .from("membership_commissions")
          .select(
            "id, earner_user_id, source_user_id, invoice_id, rate_plan_id, level, rate_pct, amount_usd, status, hold_until, created_at",
          )
          .eq("earner_user_id", userId)
          .eq("status", "payable")
          .order("created_at", { ascending: true })
      ).data
    : data;
  return (rows ?? [])
    .map(mapCommission)
    .filter((row): row is CommissionRow => row !== null && !queued.has(row.id));
}

function mapCommission(row: Record<string, unknown>): CommissionRow | null {
  const status = parseCommissionStatus(row.status);
  if (!status) {
    return null;
  }
  return {
    id: String(row.id),
    earnerUserId: String(row.earner_user_id),
    sourceUserId: String(row.source_user_id),
    invoiceId: String(row.invoice_id),
    ratePlanId: row.rate_plan_id ? String(row.rate_plan_id) : null,
    campaignId: optionalId(row.campaign_id),
    linkId: optionalId(row.link_id),
    level: Number(row.level),
    ratePct: Number(row.rate_pct),
    amountUsd: Number(row.amount_usd),
    status,
    holdUntil: String(row.hold_until),
    createdAt: String(row.created_at),
  };
}

export async function requestUsdtPayout(input: {
  userId: string;
  network: string;
  address: string;
}): Promise<{ ok: true; payoutId: string } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const payable = await listPayableCommissions(input.userId);
  const amountUsd = roundUsd(
    payable.reduce((sum, row) => sum + row.amountUsd, 0),
  );
  if (amountUsd < 0.01) {
    return { ok: false, error: "No payable earnings are ready to withdraw." };
  }
  const { data, error } = await supabase
    .from("membership_payouts")
    .insert({
      user_id: input.userId,
      method: "usdt",
      amount_usd: amountUsd,
      status: "requested",
      network: input.network,
      address: input.address,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not request payout." };
  }
  const payoutId = String(data.id);
  if (payable.length > 0) {
    const { error: itemError } = await supabase
      .from("membership_payout_items")
      .insert(
        payable.map((row) => ({
          payout_id: payoutId,
          commission_id: row.id,
        })),
      );
    if (itemError) {
      await supabase.from("membership_payouts").delete().eq("id", payoutId);
      return { ok: false, error: itemError.message };
    }
  }
  const { error: walletError } = await supabase
    .from("membership_wallet_entries")
    .insert({
      user_id: input.userId,
      book: "affiliate",
      kind: "withdraw",
      amount_usd: amountUsd,
      external_id: `payout:${payoutId}`,
      memo: "USDT withdraw requested",
    });
  if (walletError) {
    await supabase.from("membership_payout_items").delete().eq("payout_id", payoutId);
    await supabase.from("membership_payouts").delete().eq("id", payoutId);
    return { ok: false, error: walletError.message };
  }
  return { ok: true, payoutId };
}

async function loadPayout(
  payoutId: string,
): Promise<(PayoutRow & { commissionIds: string[] }) | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data } = await supabase
    .from("membership_payouts")
    .select(
      "id, user_id, method, amount_usd, status, network, address, external_id, created_at, paid_at",
    )
    .eq("id", payoutId)
    .maybeSingle();
  if (!data) {
    return null;
  }
  const mapped = mapPayout(data as Record<string, unknown>);
  if (!mapped) {
    return null;
  }
  const { data: items } = await supabase
    .from("membership_payout_items")
    .select("commission_id")
    .eq("payout_id", payoutId);
  return {
    ...mapped,
    commissionIds: (items ?? []).map((row) => String(row.commission_id)),
  };
}

function mapPayout(row: Record<string, unknown>): PayoutRow | null {
  const method = parsePayoutMethod(row.method);
  const status = parsePayoutStatus(row.status);
  if (!method || !status) {
    return null;
  }
  return {
    id: String(row.id),
    userId: String(row.user_id),
    method,
    amountUsd: Number(row.amount_usd),
    status,
    network: typeof row.network === "string" ? row.network : null,
    address: typeof row.address === "string" ? row.address : null,
    externalId: typeof row.external_id === "string" ? row.external_id : null,
    createdAt: String(row.created_at),
    paidAt: typeof row.paid_at === "string" ? row.paid_at : null,
  };
}

export async function approvePayout(
  payoutId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const payout = await loadPayout(payoutId);
  if (!payout || payout.status !== "requested") {
    return { ok: false, error: "That payout is not waiting for approval." };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase
    .from("membership_payouts")
    .update({ status: "approved" })
    .eq("id", payoutId)
    .eq("status", "requested");
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function rejectPayout(
  payoutId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const payout = await loadPayout(payoutId);
  if (!payout || (payout.status !== "requested" && payout.status !== "approved")) {
    return { ok: false, error: "That payout cannot be rejected." };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data: existing } = await supabase
    .from("membership_wallet_entries")
    .select("id")
    .eq("external_id", `payout-reject:${payoutId}`)
    .maybeSingle();
  if (!existing) {
    const { error: walletError } = await supabase
      .from("membership_wallet_entries")
      .insert({
        user_id: payout.userId,
        book: "affiliate",
        kind: "adjust",
        amount_usd: payout.amountUsd,
        external_id: `payout-reject:${payoutId}`,
        memo: "USDT withdraw rejected",
      });
    if (walletError) {
      return { ok: false, error: walletError.message };
    }
  }
  const { error: itemError } = await supabase
    .from("membership_payout_items")
    .delete()
    .eq("payout_id", payoutId);
  if (itemError) {
    return { ok: false, error: itemError.message };
  }
  const { error } = await supabase
    .from("membership_payouts")
    .update({ status: "rejected" })
    .eq("id", payoutId);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function markPayoutPaid(
  payoutId: string,
  externalId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const payout = await loadPayout(payoutId);
  if (!payout || payout.status === "paid" || payout.status === "rejected") {
    return { ok: false, error: "That payout cannot be marked paid." };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  if (payout.commissionIds.length > 0) {
    const { error: commissionError } = await supabase
      .from("membership_commissions")
      .update({ status: "paid" })
      .in("id", payout.commissionIds)
      .eq("status", "payable");
    if (commissionError) {
      return { ok: false, error: commissionError.message };
    }
  }
  const { error } = await supabase
    .from("membership_payouts")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      external_id: externalId ?? payout.externalId,
    })
    .eq("id", payoutId);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function listPayouts(limit = 80): Promise<PayoutRow[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data } = await supabase
    .from("membership_payouts")
    .select(
      "id, user_id, method, amount_usd, status, network, address, external_id, created_at, paid_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? [])
    .map((row) => mapPayout(row as Record<string, unknown>))
    .filter((row): row is PayoutRow => row !== null);
  const userIds = [...new Set(rows.map((row) => row.userId))];
  const emails = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("user_id, email")
      .in("user_id", userIds);
    for (const member of members ?? []) {
      emails.set(String(member.user_id), String(member.email));
    }
  }
  return rows.map((row) => ({ ...row, email: emails.get(row.userId) }));
}

async function memberLabels(
  userIds: string[],
  showEmail: boolean,
): Promise<{ labels: Map<string, string>; emails: Map<string, string> }> {
  const labels = new Map<string, string>();
  const emails = new Map<string, string>();
  if (userIds.length === 0) {
    return { labels, emails };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { labels, emails };
  }
  const [{ data: profiles }, { data: members }] = await Promise.all([
    supabase.from("trader_profiles").select("user_id, alias").in("user_id", userIds),
    supabase.from("members").select("user_id, email, plan_id").in("user_id", userIds),
  ]);
  const aliases = new Map(
    (profiles ?? []).map((row) => [String(row.user_id), String(row.alias)]),
  );
  for (const member of members ?? []) {
    const id = String(member.user_id);
    const email = String(member.email);
    emails.set(id, email);
    const alias = aliases.get(id)?.trim();
    if (alias) {
      labels.set(id, alias);
    } else if (showEmail) {
      labels.set(id, email);
    } else {
      labels.set(id, "Member");
    }
  }
  return { labels, emails };
}

async function memberPlanPrices(
  userIds: string[],
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  if (userIds.length === 0) {
    return prices;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return prices;
  }
  const listed = await listMembershipPlans();
  const byId = new Map(
    (listed.ok ? listed.plans : []).map((plan) => [plan.id, plan.priceUsd]),
  );
  const { data } = await supabase
    .from("members")
    .select("user_id, plan_id")
    .in("user_id", userIds);
  for (const row of data ?? []) {
    prices.set(String(row.user_id), byId.get(String(row.plan_id)) ?? 0);
  }
  return prices;
}

export async function loadDownline(
  rootUserId: string,
  showEmail = false,
): Promise<DownlineRow[]> {
  const settings = await loadAffiliateSettings();
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const withAttr = await supabase
    .from("membership_referrals")
    .select(
      "user_id, referrer_user_id, attributed_at, first_paid_at, campaign_id, link_id",
    );
  const referrals =
    withAttr.error && schemaGap(withAttr.error)
      ? (
          await supabase
            .from("membership_referrals")
            .select("user_id, referrer_user_id, attributed_at, first_paid_at")
        ).data
      : withAttr.data;
  const children = new Map<string, string[]>();
  const meta = new Map<
    string,
    {
      attributedAt: string;
      firstPaidAt: string | null;
      campaignId: string | null;
      linkId: string | null;
    }
  >();
  for (const row of referrals ?? []) {
    const userId = String(row.user_id);
    const referrer = String(row.referrer_user_id);
    const list = children.get(referrer) ?? [];
    list.push(userId);
    children.set(referrer, list);
    meta.set(userId, {
      attributedAt: String(row.attributed_at),
      firstPaidAt:
        typeof row.first_paid_at === "string" ? row.first_paid_at : null,
      campaignId: optionalId((row as { campaign_id?: unknown }).campaign_id),
      linkId: optionalId((row as { link_id?: unknown }).link_id),
    });
  }
  const rows: DownlineRow[] = [];
  const walk = (parent: string, level: number) => {
    if (level > settings.maxDepth) {
      return;
    }
    for (const userId of children.get(parent) ?? []) {
      const info = meta.get(userId);
      if (!info) {
        continue;
      }
      rows.push({
        userId,
        level,
        label: "Member",
        attributedAt: info.attributedAt,
        firstPaidAt: info.firstPaidAt,
        planPriceUsd: 0,
        campaignId: info.campaignId,
        linkId: info.linkId,
      });
      walk(userId, level + 1);
    }
  };
  walk(rootUserId, 1);
  const ids = rows.map((row) => row.userId);
  const [named, prices] = await Promise.all([
    memberLabels(ids, showEmail),
    memberPlanPrices(ids),
  ]);
  return rows.map((row) => ({
    ...row,
    label: named.labels.get(row.userId) ?? "Member",
    email: showEmail ? named.emails.get(row.userId) : undefined,
    planPriceUsd: prices.get(row.userId) ?? 0,
  }));
}

export function buildAffiliateTree(
  rows: DownlineRow[],
  parentChildren: Map<string, string[]>,
  rootUserId: string,
): AffiliateTreeNode[] {
  const byId = new Map(rows.map((row) => [row.userId, row]));
  const build = (userId: string, level: number): AffiliateTreeNode | null => {
    const row = byId.get(userId);
    if (!row && level > 0) {
      return null;
    }
    const children = (parentChildren.get(userId) ?? [])
      .map((childId) => build(childId, level + 1))
      .filter((node): node is AffiliateTreeNode => node !== null);
    if (!row) {
      return {
        userId,
        label: "You",
        level: 0,
        paid: true,
        children,
      };
    }
    return {
      userId: row.userId,
      label: row.label,
      level: row.level,
      paid: Boolean(row.firstPaidAt),
      children,
    };
  };
  return (parentChildren.get(rootUserId) ?? [])
    .map((id) => build(id, 1))
    .filter((node): node is AffiliateTreeNode => node !== null);
}

async function downlineChildMap(): Promise<Map<string, string[]>> {
  const supabase = createServiceClient();
  const children = new Map<string, string[]>();
  if (!supabase) {
    return children;
  }
  const { data } = await supabase
    .from("membership_referrals")
    .select("user_id, referrer_user_id");
  for (const row of data ?? []) {
    const referrer = String(row.referrer_user_id);
    const list = children.get(referrer) ?? [];
    list.push(String(row.user_id));
    children.set(referrer, list);
  }
  return children;
}

export async function loadAffiliatePortal(
  userId: string,
): Promise<AffiliatePortal> {
  const settings = await loadAffiliateSettings();
  await releaseDueCommissions();
  const ensured = await ensureReferralCode(userId);
  const code = ensured.ok ? ensured.code : null;
  const [downline, commissions, payouts, children, campaigns, links] =
    await Promise.all([
      loadDownline(userId, false),
      listEarnerCommissions(userId),
      listMemberPayouts(userId),
      downlineChildMap(),
      listAffiliateCampaigns(userId),
      listAffiliateLinks(userId),
    ]);
  const pendingUsd = roundUsd(
    commissions
      .filter((row) => row.status === "pending")
      .reduce((sum, row) => sum + row.amountUsd, 0),
  );
  const payableUsd = roundUsd(
    (await listPayableCommissions(userId)).reduce(
      (sum, row) => sum + row.amountUsd,
      0,
    ),
  );
  const paidOutUsd = roundUsd(
    payouts
      .filter((row) => row.status === "paid")
      .reduce((sum, row) => sum + row.amountUsd, 0),
  );
  const lastPaid = payouts.find((row) => row.status === "paid");
  const periodStart = Date.now() - 30 * 86_400_000;
  const earnedAllUsd = roundUsd(
    commissions
      .filter((row) => row.status !== "void")
      .reduce((sum, row) => sum + row.amountUsd, 0),
  );
  const earnedPeriodUsd = roundUsd(
    commissions
      .filter(
        (row) =>
          row.status !== "void" && Date.parse(row.createdAt) >= periodStart,
      )
      .reduce((sum, row) => sum + row.amountUsd, 0),
  );
  const paid = downline.filter((row) => row.firstPaidAt).length;
  const countsByLevel = [1, 2, 3, 4, 5].map(
    (level) => downline.filter((row) => row.level === level).length,
  );
  const referredMrrUsd = roundUsd(
    downline
      .filter((row) => row.firstPaidAt)
      .reduce((sum, row) => sum + row.planPriceUsd, 0),
  );
  const resolved = await resolveEarnerRates(userId, settings);
  const earnDepth = resolveEarnDepth(
    settings.maxDepth,
    resolved?.planCap ?? null,
  );
  const rateValues = resolved?.rates ?? programDefaultRates(settings);
  const rates: AffiliateRateCard = {
    source: resolved?.source ?? "program",
    planName: resolved?.planName ?? null,
    earnDepth,
    rows: [1, 2, 3, 4, 5].map((level) => ({
      level,
      ratePct: ratePctForLevel(rateValues, level, earnDepth),
      active: level <= earnDepth,
    })),
  };
  return {
    code,
    settings,
    rates,
    payableUsd,
    pendingUsd,
    paidOutUsd,
    lastPayoutAt: lastPaid?.paidAt ?? lastPaid?.createdAt ?? null,
    downline,
    tree: buildAffiliateTree(downline, children, userId),
    commissions,
    campaigns,
    links,
    stats: {
      attributed: downline.length,
      paid,
      conversionPct: downline.length
        ? roundUsd((paid / downline.length) * 100)
        : 0,
      activePaid: downline.filter(
        (row) => row.firstPaidAt && row.planPriceUsd > 0,
      ).length,
      countsByLevel,
      referredMrrUsd,
      earnedPeriodUsd,
      earnedAllUsd,
    },
  };
}

async function listEarnerCommissions(userId: string): Promise<CommissionRow[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("membership_commissions")
    .select(
      "id, earner_user_id, source_user_id, invoice_id, rate_plan_id, campaign_id, link_id, level, rate_pct, amount_usd, status, hold_until, created_at",
    )
    .eq("earner_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows =
    error && schemaGap(error)
      ? (
          await supabase
            .from("membership_commissions")
            .select(
              "id, earner_user_id, source_user_id, invoice_id, rate_plan_id, level, rate_pct, amount_usd, status, hold_until, created_at",
            )
            .eq("earner_user_id", userId)
            .order("created_at", { ascending: false })
            .limit(200)
        ).data
      : data;
  return (rows ?? [])
    .map((row) => mapCommission(row as Record<string, unknown>))
    .filter((row): row is CommissionRow => row !== null);
}

export async function listMemberPayouts(userId: string): Promise<PayoutRow[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data } = await supabase
    .from("membership_payouts")
    .select(
      "id, user_id, method, amount_usd, status, network, address, external_id, created_at, paid_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? [])
    .map((row) => mapPayout(row as Record<string, unknown>))
    .filter((row): row is PayoutRow => row !== null);
}

export async function findMemberByEmailOrCode(
  query: string,
): Promise<{ userId: string; email: string } | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const value = query.trim();
  if (!value) {
    return null;
  }
  const { data: byEmail } = await supabase
    .from("members")
    .select("user_id, email")
    .ilike("email", value)
    .maybeSingle();
  if (byEmail) {
    return { userId: String(byEmail.user_id), email: String(byEmail.email) };
  }
  const owner = await findReferralCodeOwner(value);
  if (!owner) {
    return null;
  }
  const { data: member } = await supabase
    .from("members")
    .select("user_id, email")
    .eq("user_id", owner.userId)
    .maybeSingle();
  return member
    ? { userId: String(member.user_id), email: String(member.email) }
    : { userId: owner.userId, email: owner.userId };
}

export async function loadMemberArrears(userId: string): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) {
    return false;
  }
  const { data } = await supabase
    .from("members")
    .select("subscription_status")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.subscription_status === "past_due";
}

async function loadReferralAttribution(
  sourceUserId: string,
): Promise<{ campaignId: string | null; linkId: string | null }> {
  const empty = { campaignId: null, linkId: null };
  const supabase = createServiceClient();
  if (!supabase) {
    return empty;
  }
  const { data, error } = await supabase
    .from("membership_referrals")
    .select("campaign_id, link_id")
    .eq("user_id", sourceUserId)
    .maybeSingle();
  if (error || !data) {
    return empty;
  }
  return {
    campaignId: optionalId(data.campaign_id),
    linkId: optionalId(data.link_id),
  };
}

export async function findOwnedAffiliateLink(
  userId: string,
  slug: string,
): Promise<{ id: string; campaignId: string | null; slug: string } | null> {
  const parsed = parseAffiliateLinkSlug(slug);
  if (!parsed.ok) {
    return null;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("membership_affiliate_links")
    .select("id, campaign_id, slug, user_id")
    .eq("user_id", userId)
    .ilike("slug", parsed.slug)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return {
    id: String(data.id),
    campaignId: optionalId(data.campaign_id),
    slug: String(data.slug),
  };
}

export async function findPublicAffiliateLink(
  slug: string,
): Promise<PublicAffiliateLink | null> {
  const parsed = parseAffiliateLinkSlug(slug);
  if (!parsed.ok) {
    return null;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("membership_affiliate_links")
    .select("id, user_id, campaign_id, slug, landing")
    .ilike("slug", parsed.slug)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const landing = parseAffiliateLanding(data.landing);
  if (!landing.ok) {
    return null;
  }
  const ensured = await ensureReferralCode(String(data.user_id));
  if (!ensured.ok) {
    return null;
  }
  return {
    id: String(data.id),
    userId: String(data.user_id),
    campaignId: optionalId(data.campaign_id),
    slug: String(data.slug),
    landing: landing.landing,
    code: ensured.code,
  };
}

export async function listAffiliateCampaigns(
  userId: string,
): Promise<AffiliateCampaignRow[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("membership_affiliate_campaigns")
    .select("id, name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    return [];
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    createdAt: String(row.created_at),
  }));
}

export async function listAffiliateLinks(
  userId: string,
): Promise<AffiliateLinkRow[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("membership_affiliate_links")
    .select("id, campaign_id, slug, name, landing, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    return [];
  }
  const campaigns = await listAffiliateCampaigns(userId);
  const names = new Map(campaigns.map((row) => [row.id, row.name]));
  const counts = new Map<string, number>();
  const refs = await supabase
    .from("membership_referrals")
    .select("link_id")
    .eq("referrer_user_id", userId);
  for (const row of refs.data ?? []) {
    const linkId = optionalId(row.link_id);
    if (!linkId) {
      continue;
    }
    counts.set(linkId, (counts.get(linkId) ?? 0) + 1);
  }
  return (data ?? [])
    .map((row) => {
      const landing = parseAffiliateLanding(row.landing);
      if (!landing.ok) {
        return null;
      }
      const campaignId = optionalId(row.campaign_id);
      return {
        id: String(row.id),
        campaignId,
        campaignName: campaignId ? (names.get(campaignId) ?? null) : null,
        slug: String(row.slug),
        name: String(row.name),
        landing: landing.landing,
        createdAt: String(row.created_at),
        attributed: counts.get(String(row.id)) ?? 0,
      };
    })
    .filter((row): row is AffiliateLinkRow => row !== null);
}

export async function createAffiliateCampaign(input: {
  userId: string;
  name: unknown;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = parseAffiliateLabel(
    input.name,
    AFFILIATE_CAMPAIGN_NAME_MAX,
    "Enter a campaign name (1–40 characters).",
  );
  if (!name.ok) {
    return name;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const existing = await listAffiliateCampaigns(input.userId);
  if (existing.length >= AFFILIATE_CAMPAIGN_MAX) {
    return {
      ok: false,
      error: `You can create up to ${AFFILIATE_CAMPAIGN_MAX} campaigns.`,
    };
  }
  const { data, error } = await supabase
    .from("membership_affiliate_campaigns")
    .insert({ user_id: input.userId, name: name.name })
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "You already have a campaign with that name." };
    }
    if (schemaGap(error)) {
      return { ok: false, error: "Campaigns are not available yet." };
    }
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Could not create that campaign." };
  }
  return { ok: true, id: String(data.id) };
}

export async function createAffiliateLink(input: {
  userId: string;
  name: unknown;
  landing: unknown;
  campaignId: string | null;
}): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const name = parseAffiliateLabel(
    input.name,
    AFFILIATE_LINK_NAME_MAX,
    "Enter a link name (1–40 characters).",
  );
  if (!name.ok) {
    return name;
  }
  const landing = parseAffiliateLanding(input.landing);
  if (!landing.ok) {
    return landing;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  if (input.campaignId) {
    const { data: campaign } = await supabase
      .from("membership_affiliate_campaigns")
      .select("id")
      .eq("id", input.campaignId)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (!campaign) {
      return { ok: false, error: "That campaign was not found." };
    }
  }
  const existing = await listAffiliateLinks(input.userId);
  if (existing.length >= AFFILIATE_LINK_MAX) {
    return {
      ok: false,
      error: `You can create up to ${AFFILIATE_LINK_MAX} links.`,
    };
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = generateAffiliateLinkSlug(randomBytes(8)).slice(
      0,
      AFFILIATE_LINK_SLUG_MAX,
    );
    const { error } = await supabase.from("membership_affiliate_links").insert({
      user_id: input.userId,
      campaign_id: input.campaignId,
      slug,
      name: name.name,
      landing: landing.landing,
    });
    if (!error) {
      return { ok: true, slug };
    }
    if (error.code === "23505") {
      continue;
    }
    if (schemaGap(error)) {
      return { ok: false, error: "Custom links are not available yet." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Could not allocate a link slug." };
}
