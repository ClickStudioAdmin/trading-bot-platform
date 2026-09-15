import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  AFFILIATE_ALIAS_TAKEN,
  AFFILIATE_CAMPAIGN_MAX,
  AFFILIATE_CAMPAIGN_NAME_MAX,
  AFFILIATE_LINK_MAX,
  AFFILIATE_LINK_NAME_MAX,
  AFFILIATE_LINK_SLUG_MAX,
  EMPTY_AFFILIATE_PAYOUT_SETTINGS,
  EMPTY_AFFILIATE_SETTINGS,
  affiliateRateKeyForLevel,
  autoPayoutDecision,
  canCreateCommissionInvoice,
  commissionUsd,
  generateAffiliateLinkSlug,
  generateReferralCode,
  holdUntilIso,
  pickCommissionsForPayout,
  parseAffiliateCookieDays,
  parseAffiliateHoldDays,
  parseAffiliateLabel,
  parseAffiliateLanding,
  parseAffiliateLinkSlug,
  parseAffiliateMaxDepth,
  parseAffiliateMinPayout,
  parseCommissionStatus,
  parseDowngradeGraceDays,
  chunkPayoutsForAirdropFiles,
  parsePayoutBook,
  parsePayoutFileStatus,
  parsePayoutMethod,
  parsePayoutStatus,
  payoutEligibleForAirdropFile,
  summarizeAdminPayoutQueue,
  parseAffiliateRatePct,
  parseReferralCode,
  programDefaultRates,
  ratePctForLevel,
  affiliateRateCardRows,
  resolveEarnDepth,
  affiliateNetworkLabel,
  affiliateOrgRunRateUsd,
  affiliateRateSource,
  clampAffiliateDepth,
  sortDownlineNewestFirst,
  unpaidUsesProgramAffiliateRates,
  walkUpline,
  wouldCreateReferralCycle,
  AFFILIATE_SYSTEM_LINK_ID,
  AFFILIATE_SYSTEM_LINK_NAME,
  type AffiliateLanding,
  type AffiliateLinkKind,
  type AffiliatePayoutSettings,
  type AffiliateProgramSettings,
  type AdminPayoutQueueStats,
  type CommissionStatus,
  type GeneratePayoutFilesInput,
  type PayoutFileStatus,
  type PayoutStatus,
} from "./affiliate";
import { planAffiliateRate, type MembershipPlan } from "./catalog";
import {
  getMembershipPlan,
  listMembershipPlans,
} from "./store";
import { rememberAffiliateCookieDays } from "./affiliate-cookie-days";
import {
  bookBalancesFromEntries,
  roundUsd,
  type WalletBook,
} from "./wallet";

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
  payoutFileId: string | null;
  book: WalletBook;
  email?: string;
};

export type PayoutFileRow = {
  id: string;
  network: string;
  status: PayoutFileStatus;
  amountUsd: number;
  payoutCount: number;
  externalId: string | null;
  createdAt: string;
  paidAt: string | null;
  book: WalletBook;
};

export type DownlineRow = {
  userId: string;
  level: number;
  label: string;
  email?: string;
  attributedAt: string;
  firstPaidAt: string | null;
  planPriceUsd: number;
  planName: string | null;
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
  archivedAt: string | null;
};

export type AffiliateLinkRow = {
  id: string;
  kind: AffiliateLinkKind;
  campaignId: string | null;
  campaignName: string | null;
  slug: string;
  name: string;
  landing: AffiliateLanding;
  createdAt: string;
  attributed: number;
  archivedAt: string | null;
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
  archivedCampaigns: AffiliateCampaignRow[];
  links: AffiliateLinkRow[];
  archivedLinks: AffiliateLinkRow[];
  payoutSettings: AffiliatePayoutSettings;
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
  planName: string | null;
  runRateUsd: number;
  children: AffiliateTreeNode[];
};

function schemaGap(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    /does not exist/i.test(error.message ?? "")
  );
}

const PAYOUT_COLUMNS =
  "id, user_id, method, amount_usd, status, network, address, external_id, created_at, paid_at, payout_file_id";
const PAYOUT_COLUMNS_FULL = `${PAYOUT_COLUMNS}, book`;
const PAYOUT_FILE_COLUMNS =
  "id, network, status, amount_usd, payout_count, external_id, created_at, paid_at";
const PAYOUT_FILE_COLUMNS_FULL = `${PAYOUT_FILE_COLUMNS}, book`;

async function mainBookUsd(userId: string): Promise<number> {
  const supabase = createServiceClient();
  if (!supabase) {
    return 0;
  }
  const { data } = await supabase
    .from("membership_wallet_entries")
    .select("kind, amount_usd, book")
    .eq("user_id", userId);
  return bookBalancesFromEntries(
    (data ?? []).map((row) => ({
      kind: String(row.kind),
      amountUsd: Number(row.amount_usd),
      book: typeof row.book === "string" ? row.book : null,
    })),
  ).main;
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
  return (await listReferralAttributionRows()).map((row) => ({
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
  earnerUserId?: string,
): Promise<{ ok: true; released: number } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  let query = supabase
    .from("membership_commissions")
    .select("id, earner_user_id, amount_usd, level")
    .eq("status", "pending")
    .lte("hold_until", new Date(nowMs).toISOString());
  if (earnerUserId) {
    query = query.eq("earner_user_id", earnerUserId);
  }
  const { data, error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }
  let released = 0;
  const earners = new Set<string>();
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
    earners.add(String(row.earner_user_id));
  }
  for (const earnerId of earners) {
    await maybeAutoAffiliatePayout(earnerId);
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

export async function sumPayableAffiliateUsd(userId: string): Promise<number> {
  const payable = await listPayableCommissions(userId);
  return roundUsd(payable.reduce((sum, row) => sum + row.amountUsd, 0));
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
  amountUsd: number;
  book?: WalletBook;
}): Promise<{ ok: true; payoutId: string } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const book = input.book ?? "affiliate";
  const amountUsd = roundUsd(input.amountUsd);
  let items: Awaited<ReturnType<typeof listPayableCommissions>> = [];
  if (book === "affiliate") {
    const payable = await listPayableCommissions(input.userId);
    const payableUsd = roundUsd(
      payable.reduce((sum, row) => sum + row.amountUsd, 0),
    );
    if (payableUsd < 0.01) {
      return { ok: false, error: "No payable earnings are ready to withdraw." };
    }
    items = pickCommissionsForPayout(payable, amountUsd);
    const allocated = roundUsd(
      items.reduce((sum, row) => sum + row.amountUsd, 0),
    );
    if (allocated + 1e-9 < amountUsd) {
      return { ok: false, error: "That amount is not available to withdraw." };
    }
  } else {
    const available = await mainBookUsd(input.userId);
    if (available + 1e-9 < amountUsd) {
      return { ok: false, error: "That amount is not available to withdraw." };
    }
  }
  let inserted = await supabase
    .from("membership_payouts")
    .insert({
      user_id: input.userId,
      method: "usdt",
      amount_usd: amountUsd,
      status: "requested",
      network: input.network,
      address: input.address,
      book,
    })
    .select("id")
    .single();
  if (inserted.error && schemaGap(inserted.error) && book === "affiliate") {
    inserted = await supabase
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
  }
  const { data, error } = inserted;
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not request payout." };
  }
  const payoutId = String(data.id);
  if (items.length > 0) {
    const { error: itemError } = await supabase
      .from("membership_payout_items")
      .insert(
        items.map((row) => ({
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
      book,
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

export async function loadAffiliatePayoutSettings(
  userId: string,
): Promise<AffiliatePayoutSettings> {
  const supabase = createServiceClient();
  if (!supabase) {
    return EMPTY_AFFILIATE_PAYOUT_SETTINGS;
  }
  const { data, error } = await supabase
    .from("membership_affiliate_payout_settings")
    .select("network, address, auto_payout, auto_payout_usd")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    return EMPTY_AFFILIATE_PAYOUT_SETTINGS;
  }
  return {
    network: typeof data.network === "string" ? data.network : null,
    address: typeof data.address === "string" ? data.address : null,
    autoPayout: data.auto_payout === true,
    autoPayoutUsd:
      data.auto_payout_usd != null && Number.isFinite(Number(data.auto_payout_usd))
        ? Number(data.auto_payout_usd)
        : null,
  };
}

export async function saveAffiliatePayoutSettings(input: {
  userId: string;
  network: string;
  address: string;
  autoPayout: boolean;
  autoPayoutUsd: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase.from("membership_affiliate_payout_settings").upsert({
    user_id: input.userId,
    network: input.network,
    address: input.address,
    auto_payout: input.autoPayout,
    auto_payout_usd: input.autoPayoutUsd,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function maybeAutoAffiliatePayout(
  userId: string,
): Promise<{ ok: true; payoutId?: string } | { ok: false; error: string }> {
  const [saved, program, arrears, payable] = await Promise.all([
    loadAffiliatePayoutSettings(userId),
    loadAffiliateSettings(),
    loadMemberArrears(userId),
    listPayableCommissions(userId),
  ]);
  const payableUsd = roundUsd(
    payable.reduce((sum, row) => sum + row.amountUsd, 0),
  );
  const decision = autoPayoutDecision({
    autoPayout: saved.autoPayout,
    autoPayoutUsd: saved.autoPayoutUsd,
    minPayoutUsd: program.minPayoutUsd,
    payableUsd,
    arrears,
    address: saved.address,
    network: saved.network,
  });
  if (!decision.ok) {
    return { ok: true };
  }
  if (!saved.network || !saved.address) {
    return { ok: true };
  }
  return requestUsdtPayout({
    userId,
    network: saved.network,
    address: saved.address,
    amountUsd: decision.amountUsd,
  });
}

async function loadPayout(
  payoutId: string,
): Promise<(PayoutRow & { commissionIds: string[] }) | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const full = await supabase
    .from("membership_payouts")
    .select(PAYOUT_COLUMNS_FULL)
    .eq("id", payoutId)
    .maybeSingle();
  const data =
    full.error && schemaGap(full.error)
      ? (
          await supabase
            .from("membership_payouts")
            .select(PAYOUT_COLUMNS)
            .eq("id", payoutId)
            .maybeSingle()
        ).data
      : full.data;
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
    payoutFileId:
      typeof row.payout_file_id === "string" ? row.payout_file_id : null,
    book: parsePayoutBook(row.book),
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
  if (!payout || !payoutEligibleForAirdropFile(payout.status)) {
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
        book: payout.book,
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

export async function listPayouts(
  limit = 80,
  book: WalletBook = "affiliate",
): Promise<PayoutRow[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const full = await supabase
    .from("membership_payouts")
    .select(PAYOUT_COLUMNS_FULL)
    .eq("book", book)
    .order("created_at", { ascending: false })
    .limit(limit);
  const data =
    full.error && schemaGap(full.error) && book === "affiliate"
      ? (
          await supabase
            .from("membership_payouts")
            .select(PAYOUT_COLUMNS)
            .order("created_at", { ascending: false })
            .limit(limit)
        ).data
      : full.error && schemaGap(full.error)
        ? []
        : full.data;
  const rows = (data ?? [])
    .map((row) => mapPayout(row as Record<string, unknown>))
    .filter((row): row is PayoutRow => row !== null);
  return withPayoutEmails(supabase, rows);
}

async function withPayoutEmails(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  rows: PayoutRow[],
): Promise<PayoutRow[]> {
  const userIds = [...new Set(rows.map((row) => row.userId))];
  const emails = new Map<string, string>();
  if (userIds.length === 0) {
    return rows;
  }
  const { data: members } = await supabase
    .from("members")
    .select("user_id, email")
    .in("user_id", userIds);
  for (const member of members ?? []) {
    emails.set(String(member.user_id), String(member.email));
  }
  return rows.map((row) => ({ ...row, email: emails.get(row.userId) }));
}

function mapPayoutFile(row: Record<string, unknown>): PayoutFileRow | null {
  const status = parsePayoutFileStatus(row.status);
  if (!status) {
    return null;
  }
  return {
    id: String(row.id),
    network: String(row.network),
    status,
    amountUsd: Number(row.amount_usd),
    payoutCount: Number(row.payout_count),
    externalId: typeof row.external_id === "string" ? row.external_id : null,
    createdAt: String(row.created_at),
    paidAt: typeof row.paid_at === "string" ? row.paid_at : null,
    book: parsePayoutBook(row.book),
  };
}

export async function listPayoutFiles(
  limit = 80,
  book: WalletBook = "affiliate",
): Promise<PayoutFileRow[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const full = await supabase
    .from("membership_payout_files")
    .select(PAYOUT_FILE_COLUMNS_FULL)
    .eq("book", book)
    .order("created_at", { ascending: false })
    .limit(limit);
  const data =
    full.error && schemaGap(full.error) && book === "affiliate"
      ? (
          await supabase
            .from("membership_payout_files")
            .select(PAYOUT_FILE_COLUMNS)
            .order("created_at", { ascending: false })
            .limit(limit)
        ).data
      : full.error && schemaGap(full.error)
        ? []
        : full.data;
  return (data ?? [])
    .map((row) => mapPayoutFile(row as Record<string, unknown>))
    .filter((row): row is PayoutFileRow => row !== null);
}

export async function loadAdminPayoutQueueStats(
  book: WalletBook = "affiliate",
): Promise<AdminPayoutQueueStats> {
  const empty = summarizeAdminPayoutQueue([], 0);
  const supabase = createServiceClient();
  if (!supabase) {
    return empty;
  }
  const payoutsQuery = supabase
    .from("membership_payouts")
    .select("amount_usd, status, network, address, book")
    .eq("book", book);
  const filesQuery = supabase
    .from("membership_payout_files")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .eq("book", book);
  const [payoutsResult, files] = await Promise.all([payoutsQuery, filesQuery]);
  const data =
    payoutsResult.error &&
    schemaGap(payoutsResult.error) &&
    book === "affiliate"
      ? (
          await supabase
            .from("membership_payouts")
            .select("amount_usd, status, network, address")
        ).data
      : payoutsResult.error && schemaGap(payoutsResult.error)
        ? []
        : payoutsResult.data;
  const rows = (data ?? []).flatMap((row) => {
    const status = parsePayoutStatus(row.status);
    if (!status) {
      return [];
    }
    return [
      {
        status,
        amountUsd: Number(row.amount_usd),
        network: typeof row.network === "string" ? row.network : null,
        address: typeof row.address === "string" ? row.address : null,
      },
    ];
  });
  const pendingFileCount =
    files.error && schemaGap(files.error) && book === "affiliate"
      ? (
          await supabase
            .from("membership_payout_files")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
        ).count ?? 0
      : files.error && schemaGap(files.error)
        ? 0
        : files.count ?? 0;
  return summarizeAdminPayoutQueue(rows, pendingFileCount);
}

export async function loadPayoutFile(
  fileId: string,
): Promise<PayoutFileRow | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const full = await supabase
    .from("membership_payout_files")
    .select(PAYOUT_FILE_COLUMNS_FULL)
    .eq("id", fileId)
    .maybeSingle();
  const data =
    full.error && schemaGap(full.error)
      ? (
          await supabase
            .from("membership_payout_files")
            .select(PAYOUT_FILE_COLUMNS)
            .eq("id", fileId)
            .maybeSingle()
        ).data
      : full.data;
  if (!data) {
    return null;
  }
  return mapPayoutFile(data as Record<string, unknown>);
}

export async function listPayoutsForFile(fileId: string): Promise<PayoutRow[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const full = await supabase
    .from("membership_payouts")
    .select(PAYOUT_COLUMNS_FULL)
    .eq("payout_file_id", fileId)
    .order("created_at", { ascending: true });
  const data =
    full.error && schemaGap(full.error)
      ? (
          await supabase
            .from("membership_payouts")
            .select(PAYOUT_COLUMNS)
            .eq("payout_file_id", fileId)
            .order("created_at", { ascending: true })
        ).data
      : full.data;
  const rows = (data ?? [])
    .map((row) => mapPayout(row as Record<string, unknown>))
    .filter((row): row is PayoutRow => row !== null);
  return withPayoutEmails(supabase, rows);
}

export async function generatePayoutFiles(
  input: GeneratePayoutFilesInput,
): Promise<{ ok: true; files: PayoutFileRow[] } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const book = input.book ?? "affiliate";
  const full = await supabase
    .from("membership_payouts")
    .select(PAYOUT_COLUMNS_FULL)
    .eq("book", book)
    .in("status", ["requested", "approved"])
    .order("created_at", { ascending: true });
  const fallback =
    full.error && schemaGap(full.error) && book === "affiliate"
      ? await supabase
          .from("membership_payouts")
          .select(PAYOUT_COLUMNS)
          .in("status", ["requested", "approved"])
          .order("created_at", { ascending: true })
      : null;
  const error = fallback ? fallback.error : full.error;
  const data = fallback ? fallback.data : full.data;
  if (error) {
    return { ok: false, error: error.message };
  }
  const eligible = (data ?? [])
    .map((row) => mapPayout(row as Record<string, unknown>))
    .filter((row): row is PayoutRow => row !== null)
    .filter(
      (row) =>
        payoutEligibleForAirdropFile(row.status) &&
        Boolean(row.network?.trim()) &&
        Boolean(row.address?.trim()) &&
        (!input.network || String(row.network).toLowerCase() === input.network),
    );
  if (eligible.length === 0) {
    return {
      ok: false,
      error: input.network
        ? "No requested payouts on that chain with an address."
        : "No requested payouts with a chain and address.",
    };
  }
  const byNetwork = new Map<string, PayoutRow[]>();
  for (const row of eligible) {
    const network = String(row.network);
    const group = byNetwork.get(network) ?? [];
    group.push(row);
    byNetwork.set(network, group);
  }
  const files: PayoutFileRow[] = [];
  for (const [network, rows] of byNetwork) {
    const chunks = chunkPayoutsForAirdropFiles(rows, {
      maxRows: input.maxRows,
      maxAmountUsd: input.maxAmountUsd,
    });
    for (const chunk of chunks) {
      const created = await createPayoutFile(supabase, network, chunk, book);
      if (!created.ok) {
        return created;
      }
      if (created.file) {
        files.push(created.file);
      }
    }
  }
  if (files.length === 0) {
    return {
      ok: false,
      error: "No requested payouts with a chain and address.",
    };
  }
  return { ok: true, files };
}

async function createPayoutFile(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  network: string,
  rows: PayoutRow[],
  book: WalletBook,
): Promise<
  | { ok: true; file: PayoutFileRow | null }
  | { ok: false; error: string }
> {
  const amountUsd = roundUsd(
    rows.reduce((sum, row) => sum + row.amountUsd, 0),
  );
  let createdRow = await supabase
    .from("membership_payout_files")
    .insert({
      network,
      status: "pending",
      amount_usd: amountUsd,
      payout_count: rows.length,
      book,
    })
    .select(PAYOUT_FILE_COLUMNS_FULL)
    .single();
  if (createdRow.error && schemaGap(createdRow.error) && book === "affiliate") {
    createdRow = await supabase
      .from("membership_payout_files")
      .insert({
        network,
        status: "pending",
        amount_usd: amountUsd,
        payout_count: rows.length,
      })
      .select(PAYOUT_FILE_COLUMNS)
      .single();
  }
  const { data: created, error: createError } = createdRow;
  if (createError || !created) {
    return {
      ok: false,
      error: createError?.message ?? "Could not create a payout file.",
    };
  }
  const mapped = mapPayoutFile(created as Record<string, unknown>);
  if (!mapped) {
    return { ok: false, error: "Could not create a payout file." };
  }
  const { data: claimed, error: claimError } = await supabase
    .from("membership_payouts")
    .update({
      status: "pending",
      payout_file_id: mapped.id,
    })
    .in(
      "id",
      rows.map((row) => row.id),
    )
    .in("status", ["requested", "approved"])
    .select("id, amount_usd");
  if (claimError) {
    await supabase.from("membership_payout_files").delete().eq("id", mapped.id);
    return { ok: false, error: claimError.message };
  }
  const claimedRows = claimed ?? [];
  if (claimedRows.length === 0) {
    await supabase.from("membership_payout_files").delete().eq("id", mapped.id);
    return { ok: true, file: null };
  }
  const claimedAmount = roundUsd(
    claimedRows.reduce((sum, row) => sum + Number(row.amount_usd), 0),
  );
  if (
    claimedRows.length !== mapped.payoutCount ||
    claimedAmount !== mapped.amountUsd
  ) {
    const { error: fixError } = await supabase
      .from("membership_payout_files")
      .update({
        amount_usd: claimedAmount,
        payout_count: claimedRows.length,
      })
      .eq("id", mapped.id);
    if (fixError) {
      return { ok: false, error: fixError.message };
    }
    return {
      ok: true,
      file: {
        ...mapped,
        amountUsd: claimedAmount,
        payoutCount: claimedRows.length,
      },
    };
  }
  return { ok: true, file: mapped };
}

export async function markPayoutFilePaid(
  fileId: string,
  externalId?: string | null,
): Promise<{ ok: true; payoutCount: number } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data: fileRow } = await supabase
    .from("membership_payout_files")
    .select(PAYOUT_FILE_COLUMNS_FULL)
    .eq("id", fileId)
    .maybeSingle();
  const file = fileRow
    ? mapPayoutFile(fileRow as Record<string, unknown>)
    : null;
  if (!file) {
    return { ok: false, error: "That payout file was not found." };
  }
  if (file.status === "paid") {
    return { ok: true, payoutCount: file.payoutCount };
  }
  if (file.status !== "pending") {
    return { ok: false, error: "That payout file cannot be marked paid." };
  }
  const payouts = await listPayoutsForFile(fileId);
  const open = payouts.filter((row) => row.status === "pending");
  if (open.length === 0 && payouts.some((row) => row.status !== "paid")) {
    return { ok: false, error: "That payout file has no pending requests." };
  }
  for (const payout of open) {
    const saved = await markPayoutPaid(payout.id, externalId ?? payout.externalId);
    if (!saved.ok) {
      return saved;
    }
  }
  const { error } = await supabase
    .from("membership_payout_files")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      external_id: externalId ?? file.externalId,
    })
    .eq("id", fileId)
    .eq("status", "pending");
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, payoutCount: open.length || file.payoutCount };
}

const USER_ID_IN_CHUNK = 100;
const REFERRAL_PAGE_SIZE = 1000;

async function selectInChunks<T extends Record<string, unknown>>(
  ids: string[],
  query: (
    chunk: string[],
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += USER_ID_IN_CHUNK) {
    chunks.push(ids.slice(i, i + USER_ID_IN_CHUNK));
  }
  const pages = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await query(chunk);
      return error ? [] : (data ?? []);
    }),
  );
  return pages.flat();
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
  const members = await selectInChunks(userIds, (chunk) =>
    supabase
      .from("members")
      .select("user_id, email, name, affiliate_alias")
      .in("user_id", chunk),
  );
  for (const member of members) {
    const id = String(member.user_id);
    const alias = String(member.affiliate_alias ?? "").trim();
    const name = String(member.name ?? "").trim();
    labels.set(id, affiliateNetworkLabel({ alias, name }));
    if (showEmail) {
      emails.set(id, String(member.email));
      if (!alias) {
        labels.set(id, String(member.email));
      }
    }
  }
  for (const userId of userIds) {
    if (!labels.has(userId)) {
      labels.set(userId, "Member");
    }
  }
  return { labels, emails };
}

export async function loadAffiliateAlias(
  userId: string,
): Promise<string | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("members")
    .select("affiliate_alias")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const alias = String(data.affiliate_alias ?? "").trim();
  return alias || null;
}

export async function saveAffiliateAlias(input: {
  userId: string;
  alias: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase
    .from("members")
    .update({ affiliate_alias: input.alias, updated_at: new Date().toISOString() })
    .eq("user_id", input.userId);
  if (error?.code === "23505") {
    return { ok: false, error: AFFILIATE_ALIAS_TAKEN };
  }
  if (error) {
    return { ok: false, error: "Could not save affiliate alias." };
  }
  return { ok: true };
}

async function memberPlans(
  userIds: string[],
): Promise<Map<string, { priceUsd: number; planName: string | null }>> {
  const plans = new Map<string, { priceUsd: number; planName: string | null }>();
  if (userIds.length === 0) {
    return plans;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return plans;
  }
  const listed = await listMembershipPlans();
  const byId = new Map(
    (listed.ok ? listed.plans : []).map((plan) => [plan.id, plan]),
  );
  const data = await selectInChunks(userIds, (chunk) =>
    supabase.from("members").select("user_id, plan_id").in("user_id", chunk),
  );
  for (const row of data) {
    const plan = byId.get(String(row.plan_id));
    plans.set(String(row.user_id), {
      priceUsd: plan?.priceUsd ?? 0,
      planName: plan?.name ?? null,
    });
  }
  return plans;
}

type ReferralAttrRow = {
  user_id: unknown;
  referrer_user_id: unknown;
  attributed_at: unknown;
  first_paid_at: unknown;
  campaign_id?: unknown;
  link_id?: unknown;
};

type DownlineGraph = {
  rows: DownlineRow[];
  children: Map<string, string[]>;
};

async function listReferralAttributionRows(): Promise<ReferralAttrRow[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const columnSets = [
    "user_id, referrer_user_id, attributed_at, first_paid_at, campaign_id, link_id",
    "user_id, referrer_user_id, attributed_at, first_paid_at",
    "user_id, referrer_user_id",
  ];
  let columnsIndex = 0;
  const rows: ReferralAttrRow[] = [];
  for (let from = 0; ; ) {
    const { data, error } = await supabase
      .from("membership_referrals")
      .select(columnSets[columnsIndex])
      .order("user_id", { ascending: true })
      .range(from, from + REFERRAL_PAGE_SIZE - 1);
    if (error && schemaGap(error) && columnsIndex < columnSets.length - 1) {
      columnsIndex += 1;
      from = 0;
      rows.length = 0;
      continue;
    }
    if (error) {
      break;
    }
    rows.push(...(((data ?? []) as unknown) as ReferralAttrRow[]));
    if ((data ?? []).length < REFERRAL_PAGE_SIZE) {
      break;
    }
    from += REFERRAL_PAGE_SIZE;
  }
  return rows;
}

async function applyDownlineMeta(
  rows: DownlineRow[],
  showEmail: boolean,
  options: { includeLabels?: boolean } = {},
): Promise<DownlineRow[]> {
  if (rows.length === 0) {
    return rows;
  }
  const includeLabels = options.includeLabels ?? true;
  const planIds = includeLabels
    ? rows.map((row) => row.userId)
    : rows.filter((row) => row.firstPaidAt).map((row) => row.userId);
  const [named, plans] = await Promise.all([
    includeLabels
      ? memberLabels(
          rows.map((row) => row.userId),
          showEmail,
        )
      : Promise.resolve({
          labels: new Map<string, string>(),
          emails: new Map<string, string>(),
        }),
    memberPlans(planIds),
  ]);
  return rows.map((row) => ({
    ...row,
    label: named.labels.get(row.userId) ?? "Member",
    email: showEmail ? named.emails.get(row.userId) : undefined,
    planPriceUsd: plans.get(row.userId)?.priceUsd ?? 0,
    planName: plans.get(row.userId)?.planName ?? null,
  }));
}

async function loadDownlineGraph(
  rootUserId: string,
  maxDepth: number,
): Promise<DownlineGraph> {
  const children = new Map<string, string[]>();
  const referrals = await listReferralAttributionRows();
  const meta = new Map<
    string,
    {
      attributedAt: string;
      firstPaidAt: string | null;
      campaignId: string | null;
      linkId: string | null;
    }
  >();
  for (const row of referrals) {
    const userId = String(row.user_id);
    const referrer = String(row.referrer_user_id);
    const list = children.get(referrer) ?? [];
    list.push(userId);
    children.set(referrer, list);
    meta.set(userId, {
      attributedAt:
        typeof row.attributed_at === "string" ? row.attributed_at : "",
      firstPaidAt:
        typeof row.first_paid_at === "string" ? row.first_paid_at : null,
      campaignId: optionalId(row.campaign_id),
      linkId: optionalId(row.link_id),
    });
  }
  const depth = clampAffiliateDepth(maxDepth);
  const rows: DownlineRow[] = [];
  const walk = (parent: string, level: number) => {
    if (level > depth) {
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
        planName: null,
        campaignId: info.campaignId,
        linkId: info.linkId,
      });
      walk(userId, level + 1);
    }
  };
  walk(rootUserId, 1);
  return { rows: sortDownlineNewestFirst(rows), children };
}

export async function loadDownline(
  rootUserId: string,
  showEmail = false,
): Promise<DownlineRow[]> {
  const settings = await loadAffiliateSettings();
  const graph = await loadDownlineGraph(rootUserId, settings.maxDepth);
  return applyDownlineMeta(graph.rows, showEmail);
}

export function buildAffiliateTree(
  rows: DownlineRow[],
  parentChildren: Map<string, string[]>,
  rootUserId: string,
  options: { ratePctForLevel?: (level: number) => number } = {},
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
        planName: null,
        runRateUsd: 0,
        children,
      };
    }
    const paid = Boolean(row.firstPaidAt);
    return {
      userId: row.userId,
      label: row.label,
      level: row.level,
      paid,
      planName: row.planName,
      runRateUsd: affiliateOrgRunRateUsd({
        planPriceUsd: row.planPriceUsd,
        paid,
        ratePct: options.ratePctForLevel?.(row.level) ?? 0,
      }),
      children,
    };
  };
  return (parentChildren.get(rootUserId) ?? [])
    .map((id) => build(id, 1))
    .filter((node): node is AffiliateTreeNode => node !== null);
}

export async function loadAffiliatePortal(
  userId: string,
  options: { includeTree?: boolean; includeLabels?: boolean } = {},
): Promise<AffiliatePortal> {
  const settings = await loadAffiliateSettings();
  await releaseDueCommissions(Date.now(), userId);
  await maybeAutoAffiliatePayout(userId);
  const ensured = await ensureReferralCode(userId);
  const code = ensured.ok ? ensured.code : null;
  const [graph, commissions, payouts, campaigns, links, payoutSettings] =
    await Promise.all([
      loadDownlineGraph(userId, settings.maxDepth),
      listEarnerCommissions(userId),
      listMemberPayouts(userId),
      listAffiliateCampaigns(userId),
      listAffiliateLinks(userId),
      loadAffiliatePayoutSettings(userId),
    ]);
  const downline = await applyDownlineMeta(graph.rows, false, {
    includeLabels: options.includeLabels ?? options.includeTree,
  });
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
    rows: affiliateRateCardRows(rateValues, earnDepth),
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
    tree: options.includeTree
      ? buildAffiliateTree(downline, graph.children, userId, {
          ratePctForLevel: (level) =>
            ratePctForLevel(rateValues, level, earnDepth),
        })
      : [],
    commissions,
    campaigns: campaigns.filter((row) => !row.archivedAt),
    archivedCampaigns: campaigns.filter((row) => row.archivedAt),
    links: withSystemAffiliateLink(
      code,
      downline,
      links.filter((row) => !row.archivedAt),
    ),
    archivedLinks: links.filter((row) => row.archivedAt),
    payoutSettings,
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

export async function listMemberPayouts(
  userId: string,
  book: WalletBook = "affiliate",
): Promise<PayoutRow[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const full = await supabase
    .from("membership_payouts")
    .select(PAYOUT_COLUMNS_FULL)
    .eq("user_id", userId)
    .eq("book", book)
    .order("created_at", { ascending: false })
    .limit(50);
  const data =
    full.error && schemaGap(full.error) && book === "affiliate"
      ? (
          await supabase
            .from("membership_payouts")
            .select(PAYOUT_COLUMNS)
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(50)
        ).data
      : full.error && schemaGap(full.error)
        ? []
        : full.data;
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
  const withArchive = await supabase
    .from("membership_affiliate_campaigns")
    .select("id, name, created_at, archived_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const data =
    withArchive.error && schemaGap(withArchive.error)
      ? (
          await supabase
            .from("membership_affiliate_campaigns")
            .select("id, name, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
        ).data
      : withArchive.data;
  if (!data && withArchive.error && !schemaGap(withArchive.error)) {
    return [];
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    createdAt: String(row.created_at),
    archivedAt: optionalId((row as { archived_at?: unknown }).archived_at),
  }));
}

function withSystemAffiliateLink(
  code: string | null,
  downline: DownlineRow[],
  links: AffiliateLinkRow[],
): AffiliateLinkRow[] {
  if (!code) {
    return links;
  }
  const attributed = downline.filter(
    (row) => row.level === 1 && !row.linkId,
  ).length;
  return [
    {
      id: AFFILIATE_SYSTEM_LINK_ID,
      kind: "system",
      campaignId: null,
      campaignName: null,
      slug: code,
      name: AFFILIATE_SYSTEM_LINK_NAME,
      landing: "affiliates",
      createdAt: "",
      attributed,
      archivedAt: null,
    },
    ...links,
  ];
}

export async function listAffiliateLinks(
  userId: string,
): Promise<AffiliateLinkRow[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const withArchive = await supabase
    .from("membership_affiliate_links")
    .select("id, campaign_id, slug, name, landing, created_at, archived_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const data =
    withArchive.error && schemaGap(withArchive.error)
      ? (
          await supabase
            .from("membership_affiliate_links")
            .select("id, campaign_id, slug, name, landing, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
        ).data
      : withArchive.data;
  if (!data && withArchive.error && !schemaGap(withArchive.error)) {
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
    .map((row): AffiliateLinkRow | null => {
      const landing = parseAffiliateLanding(row.landing);
      if (!landing.ok) {
        return null;
      }
      const campaignId = optionalId(row.campaign_id);
      return {
        id: String(row.id),
        kind: "custom",
        campaignId,
        campaignName: campaignId ? (names.get(campaignId) ?? null) : null,
        slug: String(row.slug),
        name: String(row.name),
        landing: landing.landing,
        createdAt: String(row.created_at),
        attributed: counts.get(String(row.id)) ?? 0,
        archivedAt: optionalId((row as { archived_at?: unknown }).archived_at),
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
  const existing = (await listAffiliateCampaigns(input.userId)).filter(
    (row) => !row.archivedAt,
  );
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
    "Enter a URL name (1–40 characters).",
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
    const owned = await supabase
      .from("membership_affiliate_campaigns")
      .select("id, archived_at")
      .eq("id", input.campaignId)
      .eq("user_id", input.userId)
      .maybeSingle();
    const campaign =
      owned.error && schemaGap(owned.error)
        ? (
            await supabase
              .from("membership_affiliate_campaigns")
              .select("id")
              .eq("id", input.campaignId)
              .eq("user_id", input.userId)
              .maybeSingle()
          ).data
        : owned.data;
    if (
      !campaign ||
      optionalId((campaign as { archived_at?: unknown }).archived_at)
    ) {
      return { ok: false, error: "That campaign was not found." };
    }
  }
  const existing = (await listAffiliateLinks(input.userId)).filter(
    (row) => !row.archivedAt,
  );
  if (existing.length >= AFFILIATE_LINK_MAX) {
    return {
      ok: false,
      error: `You can create up to ${AFFILIATE_LINK_MAX} URLs.`,
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
      return { ok: false, error: "Custom URLs are not available yet." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Could not allocate a URL slug." };
}

export async function archiveAffiliateCampaign(input: {
  userId: string;
  campaignId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data, error } = await supabase
    .from("membership_affiliate_campaigns")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", input.campaignId)
    .eq("user_id", input.userId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    if (schemaGap(error)) {
      return { ok: false, error: "Archive is not available yet." };
    }
    return { ok: false, error: error.message };
  }
  if (!data) {
    const existing = await supabase
      .from("membership_affiliate_campaigns")
      .select("id, archived_at")
      .eq("id", input.campaignId)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (existing.data && optionalId(existing.data.archived_at)) {
      return { ok: true };
    }
    return { ok: false, error: "That campaign was not found." };
  }
  return { ok: true };
}

export async function renameAffiliateLink(input: {
  userId: string;
  linkId: string;
  name: unknown;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.linkId === AFFILIATE_SYSTEM_LINK_ID) {
    return { ok: false, error: "The Default URL cannot be renamed." };
  }
  const name = parseAffiliateLabel(
    input.name,
    AFFILIATE_LINK_NAME_MAX,
    "Enter a URL name (1–40 characters).",
  );
  if (!name.ok) {
    return name;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data, error } = await supabase
    .from("membership_affiliate_links")
    .update({ name: name.name })
    .eq("id", input.linkId)
    .eq("user_id", input.userId)
    .select("id")
    .maybeSingle();
  if (error) {
    if (schemaGap(error)) {
      return { ok: false, error: "Custom URLs are not available yet." };
    }
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "That URL was not found." };
  }
  return { ok: true };
}

export async function archiveAffiliateLink(input: {
  userId: string;
  linkId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.linkId === AFFILIATE_SYSTEM_LINK_ID) {
    return { ok: false, error: "The Default URL cannot be archived." };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data, error } = await supabase
    .from("membership_affiliate_links")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", input.linkId)
    .eq("user_id", input.userId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    if (schemaGap(error)) {
      return { ok: false, error: "Archive is not available yet." };
    }
    return { ok: false, error: error.message };
  }
  if (!data) {
    const existing = await supabase
      .from("membership_affiliate_links")
      .select("id, archived_at")
      .eq("id", input.linkId)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (existing.data && optionalId(existing.data.archived_at)) {
      return { ok: true };
    }
    return { ok: false, error: "That URL was not found." };
  }
  return { ok: true };
}
