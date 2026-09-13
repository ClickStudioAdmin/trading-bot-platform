import {
  AFFILIATE_LEVEL_MAX,
  AFFILIATE_PCT_MAX,
  AFFILIATE_RATE_KEYS,
  affiliateRatesOk,
  type AffiliateRateKey,
} from "./catalog";
import { isEvmAddress } from "./hd";
import { roundUsd } from "./wallet";

export const AFFILIATE_MAX_DEPTH_DEFAULT = 2;
export const AFFILIATE_HOLD_DAYS_DEFAULT = 30;
export const AFFILIATE_COOKIE_DAYS_DEFAULT = 30;
export const AFFILIATE_COOKIE_DAYS_MAX = 3650;
export const AFFILIATE_MIN_PAYOUT_DEFAULT = 50;
export const AFFILIATE_PAYOUT_COIN = "USDT";
export const DOWNGRADE_GRACE_DAYS_DEFAULT = 7;
export const REFERRAL_CODE_MIN = 4;
export const REFERRAL_CODE_MAX = 32;
export const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const AFFILIATE_LINK_SLUG_MIN = 6;
export const AFFILIATE_LINK_SLUG_MAX = 16;
export const AFFILIATE_CAMPAIGN_NAME_MAX = 40;
export const AFFILIATE_LINK_NAME_MAX = 40;
export const AFFILIATE_CAMPAIGN_MAX = 40;
export const AFFILIATE_LINK_MAX = 80;
export const AFFILIATE_LANDINGS = ["home", "affiliates"] as const;
export type AffiliateLanding = (typeof AFFILIATE_LANDINGS)[number];
export const AFFILIATE_LINK_KINDS = ["system", "custom"] as const;
export type AffiliateLinkKind = (typeof AFFILIATE_LINK_KINDS)[number];
export const AFFILIATE_SYSTEM_LINK_ID = "system";
export const AFFILIATE_SYSTEM_LINK_NAME = "Default";

export const PAYOUT_METHODS = ["export", "stripe_connect", "usdt"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const PAYOUT_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "paid",
] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const COMMISSION_STATUSES = [
  "pending",
  "payable",
  "paid",
  "void",
] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export type AffiliateProgramSettings = {
  maxDepth: number;
  holdDays: number;
  minPayoutUsd: number;
  payoutCoin: string;
  downgradeGraceDays: number;
  cookieDays: number;
  defaultL1Pct: number;
  defaultL2Pct: number;
  defaultL3Pct: number;
  defaultL4Pct: number;
  defaultL5Pct: number;
};

export const EMPTY_AFFILIATE_SETTINGS: AffiliateProgramSettings = {
  maxDepth: AFFILIATE_MAX_DEPTH_DEFAULT,
  holdDays: AFFILIATE_HOLD_DAYS_DEFAULT,
  minPayoutUsd: AFFILIATE_MIN_PAYOUT_DEFAULT,
  payoutCoin: AFFILIATE_PAYOUT_COIN,
  downgradeGraceDays: DOWNGRADE_GRACE_DAYS_DEFAULT,
  cookieDays: AFFILIATE_COOKIE_DAYS_DEFAULT,
  defaultL1Pct: 0,
  defaultL2Pct: 0,
  defaultL3Pct: 0,
  defaultL4Pct: 0,
  defaultL5Pct: 0,
};

export function programDefaultRates(
  settings: Pick<
    AffiliateProgramSettings,
    | "defaultL1Pct"
    | "defaultL2Pct"
    | "defaultL3Pct"
    | "defaultL4Pct"
    | "defaultL5Pct"
  >,
): number[] {
  return [
    settings.defaultL1Pct,
    settings.defaultL2Pct,
    settings.defaultL3Pct,
    settings.defaultL4Pct,
    settings.defaultL5Pct,
  ];
}

export function parseAffiliateRatePct(
  value: unknown,
): { ok: true; pct: number } | { ok: false; error: string } {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return { ok: false, error: "Affiliate percents must be numbers." };
  }
  return { ok: true, pct: Math.round(n * 100) / 100 };
}

export function parseProgramDefaultRates(input: {
  l1: unknown;
  l2: unknown;
  l3: unknown;
  l4: unknown;
  l5: unknown;
}):
  | {
      ok: true;
      defaultL1Pct: number;
      defaultL2Pct: number;
      defaultL3Pct: number;
      defaultL4Pct: number;
      defaultL5Pct: number;
    }
  | { ok: false; error: string } {
  const l1 = parseAffiliateRatePct(input.l1);
  const l2 = parseAffiliateRatePct(input.l2);
  const l3 = parseAffiliateRatePct(input.l3);
  const l4 = parseAffiliateRatePct(input.l4);
  const l5 = parseAffiliateRatePct(input.l5);
  if (!l1.ok || !l2.ok || !l3.ok || !l4.ok || !l5.ok) {
    return { ok: false, error: "Affiliate percents must be numbers." };
  }
  if (!affiliateRatesOk(l1.pct, l2.pct, l3.pct, l4.pct, l5.pct)) {
    return {
      ok: false,
      error: `Default L1–L${AFFILIATE_LEVEL_MAX} must each be 0–${AFFILIATE_PCT_MAX} and cannot add up to more than ${AFFILIATE_PCT_MAX}%.`,
    };
  }
  return {
    ok: true,
    defaultL1Pct: l1.pct,
    defaultL2Pct: l2.pct,
    defaultL3Pct: l3.pct,
    defaultL4Pct: l4.pct,
    defaultL5Pct: l5.pct,
  };
}

export type AffiliateRateSource = "plan" | "program";

export function affiliateRateSource(input: {
  platformMember: boolean;
  pastDue: boolean;
}): AffiliateRateSource {
  if (!input.platformMember || input.pastDue) {
    return "program";
  }
  return "plan";
}

export function clampAffiliateDepth(value: number): number {
  if (!Number.isInteger(value)) {
    return AFFILIATE_MAX_DEPTH_DEFAULT;
  }
  return Math.min(AFFILIATE_LEVEL_MAX, Math.max(1, value));
}

export function parseAffiliateMaxDepth(
  value: unknown,
): { ok: true; depth: number } | { ok: false; error: string } {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > AFFILIATE_LEVEL_MAX) {
    return {
      ok: false,
      error: `Maximum depth must be 1 to ${AFFILIATE_LEVEL_MAX}.`,
    };
  }
  return { ok: true, depth: n };
}

export function parseAffiliateHoldDays(
  value: unknown,
): { ok: true; days: number } | { ok: false; error: string } {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 3650) {
    return { ok: false, error: "Hold days must be a whole number, zero or more." };
  }
  return { ok: true, days: n };
}

export function parseAffiliateCookieDays(
  value: unknown,
): { ok: true; days: number } | { ok: false; error: string } {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > AFFILIATE_COOKIE_DAYS_MAX) {
    return {
      ok: false,
      error: `Referral cookie days must be 1 to ${AFFILIATE_COOKIE_DAYS_MAX}.`,
    };
  }
  return { ok: true, days: n };
}

export function firstTouchReferralCode(
  cookie: string | null | undefined,
  url: string | null | undefined,
): string | null {
  const stored = parseOptionalReferralCode(cookie);
  if (stored.ok && stored.code) {
    return stored.code;
  }
  const incoming = parseOptionalReferralCode(url);
  return incoming.ok ? incoming.code : null;
}

export function parseAffiliateMinPayout(
  value: unknown,
): { ok: true; usd: number } | { ok: false; error: string } {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
    return { ok: false, error: "Minimum payout must be zero or more." };
  }
  return { ok: true, usd: roundUsd(n) };
}

export function parseDowngradeGraceDays(
  value: unknown,
): { ok: true; days: number } | { ok: false; error: string } {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 365) {
    return { ok: false, error: "Grace days must be a whole number, zero or more." };
  }
  return { ok: true, days: n };
}

export function parseReferralCode(
  value: unknown,
): { ok: true; code: string } | { ok: false; error: string } {
  const code = String(value ?? "").trim().toUpperCase();
  if (!code) {
    return { ok: false, error: "Enter a referral code." };
  }
  if (code.length < REFERRAL_CODE_MIN || code.length > REFERRAL_CODE_MAX) {
    return {
      ok: false,
      error: `Referral code must be ${REFERRAL_CODE_MIN} to ${REFERRAL_CODE_MAX} characters.`,
    };
  }
  if (!/^[A-Z0-9-]+$/.test(code)) {
    return { ok: false, error: "Referral code uses letters, numbers, and dashes." };
  }
  return { ok: true, code };
}

export function parseOptionalReferralCode(
  value: unknown,
): { ok: true; code: string | null } | { ok: false; error: string } {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return { ok: true, code: null };
  }
  const parsed = parseReferralCode(raw);
  return parsed.ok ? { ok: true, code: parsed.code } : parsed;
}

export function generateReferralCode(bytes: Uint8Array): string {
  let code = "";
  for (const byte of bytes) {
    code += REFERRAL_CODE_ALPHABET[byte % REFERRAL_CODE_ALPHABET.length];
  }
  return code;
}

export function generateAffiliateLinkSlug(bytes: Uint8Array): string {
  return generateReferralCode(bytes);
}

export function affiliateRateKeyForLevel(
  level: number,
): AffiliateRateKey | null {
  return AFFILIATE_RATE_KEYS[level - 1] ?? null;
}

export function resolveEarnDepth(
  programMax: number,
  planCap: number | null,
): number {
  const program = clampAffiliateDepth(programMax);
  if (planCap == null) {
    return program;
  }
  return Math.min(program, clampAffiliateDepth(planCap));
}

export function ratePctForLevel(
  rates: readonly number[],
  level: number,
  earnDepth: number,
): number {
  if (!Number.isInteger(level) || level < 1 || level > earnDepth) {
    return 0;
  }
  const rate = rates[level - 1];
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

export function commissionUsd(amountUsd: number, ratePct: number): number {
  if (amountUsd < 0.01 || ratePct <= 0) {
    return 0;
  }
  return roundUsd((amountUsd * ratePct) / 100);
}

export function holdUntilIso(nowMs: number, holdDays: number): string {
  const days = Number.isFinite(holdDays) ? Math.max(0, holdDays) : 0;
  return new Date(nowMs + days * 86_400_000).toISOString();
}

export function holdHasElapsed(holdUntilIso: string, nowMs: number): boolean {
  const until = Date.parse(holdUntilIso);
  return Number.isFinite(until) && until <= nowMs;
}

export function unpaidUsesProgramAffiliateRates(status: string): boolean {
  return status === "past_due";
}

export function canCreateCommissionInvoice(input: {
  method: string;
  status: string;
  amountUsd: number;
}): boolean {
  return (
    input.method !== "comp" &&
    input.status === "paid" &&
    input.amountUsd >= 0.01
  );
}

export type UplineHop = {
  userId: string;
  referrerUserId: string;
};

export function walkUpline(
  hops: readonly UplineHop[],
  sourceUserId: string,
  maxDepth: number,
): Array<{ earnerUserId: string; level: number }> {
  const byUser = new Map(hops.map((hop) => [hop.userId, hop.referrerUserId]));
  const seen = new Set<string>([sourceUserId]);
  const path: Array<{ earnerUserId: string; level: number }> = [];
  let current = sourceUserId;
  const depth = clampAffiliateDepth(maxDepth);
  for (let level = 1; level <= depth; level += 1) {
    const earner = byUser.get(current);
    if (!earner || seen.has(earner)) {
      break;
    }
    seen.add(earner);
    path.push({ earnerUserId: earner, level });
    current = earner;
  }
  return path;
}

export function wouldCreateReferralCycle(
  hops: readonly UplineHop[],
  newUserId: string,
  referrerUserId: string,
): boolean {
  if (newUserId === referrerUserId) {
    return true;
  }
  const path = walkUpline(hops, referrerUserId, AFFILIATE_LEVEL_MAX);
  return path.some((hop) => hop.earnerUserId === newUserId);
}

export function withdrawDecision(input: {
  arrears: boolean;
  payableUsd: number;
  minPayoutUsd: number;
}): { ok: true } | { ok: false; reason: string } {
  if (input.arrears) {
    return {
      ok: false,
      reason: "Pay outstanding subscription invoices before withdrawing.",
    };
  }
  if (input.payableUsd + 1e-9 < input.minPayoutUsd) {
    return {
      ok: false,
      reason: `Payable must be at least $${input.minPayoutUsd.toFixed(2)}.`,
    };
  }
  return { ok: true };
}

export function parsePayoutNetwork(
  value: unknown,
  allowed: readonly string[],
): { ok: true; network: string } | { ok: false; error: string } {
  const network = String(value ?? "").trim().toLowerCase();
  if (!allowed.includes(network)) {
    return { ok: false, error: "Pick a chain that allows affiliate payouts." };
  }
  return { ok: true, network };
}

export function parsePayoutAddress(
  value: unknown,
): { ok: true; address: string } | { ok: false; error: string } {
  const raw = String(value ?? "").trim();
  if (!isEvmAddress(raw)) {
    return { ok: false, error: "Enter a valid EVM address." };
  }
  return { ok: true, address: raw.toLowerCase() };
}

export function parsePayoutMethod(value: unknown): PayoutMethod | null {
  return PAYOUT_METHODS.includes(value as PayoutMethod)
    ? (value as PayoutMethod)
    : null;
}

export function parsePayoutStatus(value: unknown): PayoutStatus | null {
  return PAYOUT_STATUSES.includes(value as PayoutStatus)
    ? (value as PayoutStatus)
    : null;
}

export function parseCommissionStatus(value: unknown): CommissionStatus | null {
  return COMMISSION_STATUSES.includes(value as CommissionStatus)
    ? (value as CommissionStatus)
    : null;
}

export function referralShareUrl(origin: string, code: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/affiliates?ref=${encodeURIComponent(code)}`;
}

export function parseAffiliateLanding(
  value: unknown,
): { ok: true; landing: AffiliateLanding } | { ok: false; error: string } {
  const raw = String(value ?? "").trim();
  if (AFFILIATE_LANDINGS.includes(raw as AffiliateLanding)) {
    return { ok: true, landing: raw as AffiliateLanding };
  }
  return { ok: false, error: "Choose a landing page." };
}

export function affiliateLandingPath(landing: AffiliateLanding): string {
  return landing === "affiliates" ? "/affiliates" : "/";
}

export function affiliateLandingLabel(landing: AffiliateLanding): string {
  return landing === "affiliates" ? "Affiliate page" : "Home page";
}

export function affiliateLinkShareUrl(origin: string, slug: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/r/${encodeURIComponent(slug)}`;
}

export function affiliateLinkKindLabel(kind: AffiliateLinkKind): string {
  return kind === "system" ? "System" : "Custom";
}

export function affiliateRowShareUrl(
  origin: string,
  link: { kind: AffiliateLinkKind; slug: string },
): string {
  return link.kind === "system"
    ? referralShareUrl(origin, link.slug)
    : affiliateLinkShareUrl(origin, link.slug);
}

export function parseAffiliateLabel(
  value: unknown,
  max: number,
  emptyError: string,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(value ?? "").trim();
  if (name.length < 1 || name.length > max) {
    return { ok: false, error: emptyError };
  }
  return { ok: true, name };
}

export function parseAffiliateLinkSlug(
  value: unknown,
): { ok: true; slug: string } | { ok: false; error: string } {
  const slug = String(value ?? "").trim().toUpperCase();
  if (
    slug.length < AFFILIATE_LINK_SLUG_MIN ||
    slug.length > AFFILIATE_LINK_SLUG_MAX
  ) {
    return { ok: false, error: "That link was not found." };
  }
  if (!/^[A-Z0-9]+$/.test(slug)) {
    return { ok: false, error: "That link was not found." };
  }
  return { ok: true, slug };
}

export const AFFILIATE_PORTAL_TABS = [
  "overview",
  "network",
  "referrals",
  "links",
  "payouts",
] as const;
export type AffiliatePortalTab = (typeof AFFILIATE_PORTAL_TABS)[number];

export function parseAffiliatePortalTab(value: unknown): AffiliatePortalTab {
  const raw = String(value ?? "").trim().toLowerCase();
  return AFFILIATE_PORTAL_TABS.includes(raw as AffiliatePortalTab)
    ? (raw as AffiliatePortalTab)
    : "overview";
}

export function affiliatePortalPath(
  tab: AffiliatePortalTab = "overview",
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams();
  if (tab !== "overview") {
    params.set("tab", tab);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `/affiliates?${query}` : "/affiliates";
}

export type AffiliateStatSource = {
  attributed: number;
  paid: number;
  paidByLevel: readonly number[];
  referredMrrUsd: number;
  pendingUsd: number;
  payableUsd: number;
  paidOutUsd: number;
  earnedPeriodUsd: number;
  earnedAllUsd: number;
  lastPayoutAt: string | null;
};

export function conversionPct(attributed: number, paid: number): number {
  if (attributed <= 0) {
    return 0;
  }
  return roundUsd((paid / attributed) * 100);
}

export function monthJoinedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString("en-GB", { month: "short", year: "numeric" });
}
