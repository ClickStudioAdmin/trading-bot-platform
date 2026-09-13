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

export function affiliateOrgRunRateUsd(input: {
  planPriceUsd: number;
  paid: boolean;
  ratePct: number;
}): number {
  if (!input.paid || input.planPriceUsd < 0.01) {
    return 0;
  }
  return commissionUsd(input.planPriceUsd, input.ratePct);
}

export function affiliateOrgPlanLabel(planName: string | null | undefined): string {
  const name = String(planName ?? "").trim();
  return name || "Affiliate";
}

export function affiliateOrgRunRateLabel(
  runRateUsd: number,
  kind: "person" | "root" = "person",
): string {
  if (runRateUsd < 0.01) {
    return kind === "root" ? "$0.00 / mo" : "Signup";
  }
  return `${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(runRateUsd)} / mo`;
}

export function affiliateDownlinePersonMeta(
  row: {
    planName?: string | null;
    planPriceUsd: number;
    firstPaidAt: string | null;
    level: number;
  },
  rates: {
    earnDepth: number;
    rows: readonly { level: number; ratePct: number }[];
  },
): { planLabel: string; runRateUsd: number; runRateLabel: string } {
  const ratePct = ratePctForLevel(
    [1, 2, 3, 4, 5].map(
      (level) => rates.rows.find((item) => item.level === level)?.ratePct ?? 0,
    ),
    row.level,
    rates.earnDepth,
  );
  const runRateUsd = affiliateOrgRunRateUsd({
    planPriceUsd: row.planPriceUsd,
    paid: Boolean(row.firstPaidAt),
    ratePct,
  });
  return {
    planLabel: affiliateOrgPlanLabel(row.planName),
    runRateUsd,
    runRateLabel: affiliateOrgRunRateLabel(runRateUsd),
  };
}

export type AffiliateOrgRunRateNode = {
  runRateUsd?: number;
  children: readonly AffiliateOrgRunRateNode[];
};

export function sumAffiliateOrgRunRate(
  nodes: readonly AffiliateOrgRunRateNode[],
): number {
  return roundUsd(
    nodes.reduce(
      (sum, node) =>
        sum + (node.runRateUsd ?? 0) + sumAffiliateOrgRunRate(node.children),
      0,
    ),
  );
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

export function parsePayoutAmount(
  value: unknown,
): { ok: true; amountUsd: number } | { ok: false; error: string } {
  const raw = String(value ?? "").trim().replace(/[$,]/g, "");
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: "Enter a withdraw amount." };
  }
  const amountUsd = roundUsd(n);
  if (amountUsd < 0.01) {
    return { ok: false, error: "Enter a withdraw amount." };
  }
  return { ok: true, amountUsd };
}

export function withdrawAmountDecision(input: {
  payableUsd: number;
  minPayoutUsd: number;
  amountUsd: number;
}): { ok: true } | { ok: false; reason: string } {
  if (input.amountUsd + 1e-9 < input.minPayoutUsd) {
    return {
      ok: false,
      reason: `Amount must be at least $${input.minPayoutUsd.toFixed(2)}.`,
    };
  }
  if (input.amountUsd - 1e-9 > input.payableUsd) {
    return {
      ok: false,
      reason: `Amount cannot exceed payable $${input.payableUsd.toFixed(2)}.`,
    };
  }
  return { ok: true };
}

export function pickCommissionsForPayout<T extends { amountUsd: number }>(
  rows: readonly T[],
  amountUsd: number,
): T[] {
  const picked: T[] = [];
  let sum = 0;
  for (const row of rows) {
    if (sum + 1e-9 >= amountUsd) {
      break;
    }
    picked.push(row);
    sum = roundUsd(sum + row.amountUsd);
  }
  return picked;
}

export type AffiliatePayoutSettings = {
  network: string | null;
  address: string | null;
  autoPayout: boolean;
  autoPayoutUsd: number | null;
};

export const EMPTY_AFFILIATE_PAYOUT_SETTINGS: AffiliatePayoutSettings = {
  network: null,
  address: null,
  autoPayout: false,
  autoPayoutUsd: null,
};

export function parseAutoPayoutUsd(
  value: unknown,
  minPayoutUsd: number,
): { ok: true; usd: number } | { ok: false; error: string } {
  const parsed = parsePayoutAmount(value);
  if (!parsed.ok) {
    return { ok: false, error: "Enter an auto payout amount." };
  }
  if (parsed.amountUsd <= minPayoutUsd + 1e-9) {
    return {
      ok: false,
      error: `Auto payout must be more than the minimum $${minPayoutUsd.toFixed(2)}.`,
    };
  }
  return { ok: true, usd: parsed.amountUsd };
}

export function autoPayoutDecision(input: {
  autoPayout: boolean;
  autoPayoutUsd: number | null;
  minPayoutUsd: number;
  payableUsd: number;
  arrears: boolean;
  address: string | null;
  network: string | null;
}): { ok: true; amountUsd: number } | { ok: false; reason: string } {
  if (!input.autoPayout) {
    return { ok: false, reason: "Auto payouts are off." };
  }
  if (input.arrears) {
    return { ok: false, reason: "Pay outstanding invoices first." };
  }
  if (!input.address || !input.network) {
    return { ok: false, reason: "Save a payout chain and address first." };
  }
  if (
    input.autoPayoutUsd == null ||
    input.autoPayoutUsd <= input.minPayoutUsd + 1e-9
  ) {
    return {
      ok: false,
      reason: `Auto payout must be more than $${input.minPayoutUsd.toFixed(2)}.`,
    };
  }
  if (input.payableUsd + 1e-9 < input.autoPayoutUsd) {
    return { ok: false, reason: "Payable is under the auto payout amount." };
  }
  return { ok: true, amountUsd: roundUsd(input.payableUsd) };
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

export function canArchiveAffiliateLink(kind: AffiliateLinkKind): boolean {
  return kind === "custom";
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
  "campaigns",
  "links",
  "referrals",
  "payouts",
  "settings",
] as const;
export type AffiliatePortalTab = (typeof AFFILIATE_PORTAL_TABS)[number];
export const AFFILIATE_PORTAL_PAGE_SIZE = 20;

export function parseAffiliatePortalTab(value: unknown): AffiliatePortalTab {
  const raw = String(value ?? "").trim().toLowerCase();
  return AFFILIATE_PORTAL_TABS.includes(raw as AffiliatePortalTab)
    ? (raw as AffiliatePortalTab)
    : "overview";
}

export function parseAffiliatePortalPage(value: unknown): number {
  const page = Math.trunc(Number(String(value ?? "").trim()));
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export const AFFILIATE_NETWORK_VIEWS = ["list", "chart"] as const;
export type AffiliateNetworkView = (typeof AFFILIATE_NETWORK_VIEWS)[number];

export function parseAffiliateNetworkView(value: unknown): AffiliateNetworkView {
  const raw = String(value ?? "").trim().toLowerCase();
  return AFFILIATE_NETWORK_VIEWS.includes(raw as AffiliateNetworkView)
    ? (raw as AffiliateNetworkView)
    : "list";
}

export function paginateAffiliateList<T>(
  rows: readonly T[],
  page: number,
  pageSize = AFFILIATE_PORTAL_PAGE_SIZE,
): {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
} {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);
  return {
    rows: slice,
    page: safePage,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
  };
}

export function affiliatePageLabel(input: {
  total: number;
  from: number;
  to: number;
}): string {
  if (input.total === 0) {
    return "No rows.";
  }
  return `Showing ${input.from}–${input.to} of ${input.total}`;
}

export function affiliatePortalPageForIndex(
  index: number,
  pageSize = AFFILIATE_PORTAL_PAGE_SIZE,
): number {
  if (index < 0) {
    return 1;
  }
  return Math.floor(index / pageSize) + 1;
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

export function affiliatePortalPagePath(
  tab: AffiliatePortalTab,
  page = 1,
): string {
  return affiliatePortalPath(tab, page > 1 ? { page: String(page) } : {});
}

export function affiliateNetworkPath(
  view: AffiliateNetworkView = "list",
  page = 1,
): string {
  return affiliatePortalPath("network", {
    ...(view !== "list" ? { view } : {}),
    ...(view === "list" && page > 1 ? { page: String(page) } : {}),
  });
}

export function affiliateDownlineRowHref(
  userId: string,
  downline: readonly { userId: string }[],
): string {
  const index = downline.findIndex((row) => row.userId === userId);
  const page = affiliatePortalPageForIndex(index);
  return `${affiliateNetworkPath("list", page)}#downline-${userId}`;
}

export const AFFILIATE_ORG_ROOT_ID = "you";
export const AFFILIATE_ORG_MIN_ZOOM = 1.1;
export const AFFILIATE_ORG_LAYOUTS = ["top", "left", "right", "bottom"] as const;
export type AffiliateOrgLayout = (typeof AFFILIATE_ORG_LAYOUTS)[number];

export function parseAffiliateOrgLayout(value: unknown): AffiliateOrgLayout {
  const raw = String(value ?? "").trim().toLowerCase();
  return AFFILIATE_ORG_LAYOUTS.includes(raw as AffiliateOrgLayout)
    ? (raw as AffiliateOrgLayout)
    : "top";
}

export function affiliateOrgLayoutLabel(layout: AffiliateOrgLayout): string {
  if (layout === "right") {
    return "Right";
  }
  if (layout === "bottom") {
    return "Bottom";
  }
  if (layout === "left") {
    return "Left";
  }
  return "Top";
}

export function affiliateOrgUserZoomedOut(
  scale: number,
  minScale = AFFILIATE_ORG_MIN_ZOOM,
): boolean {
  return scale + 0.001 < minScale;
}

export function affiliateOrgAutoZoom(input: {
  fitScale: number;
  currentScale: number;
  minScale?: number;
}): number {
  const minScale = input.minScale ?? AFFILIATE_ORG_MIN_ZOOM;
  if (affiliateOrgUserZoomedOut(input.currentScale, minScale)) {
    return input.currentScale;
  }
  return Math.max(input.fitScale, input.currentScale, minScale);
}

export type AffiliateOrgChartSource = {
  userId: string;
  label: string;
  level: number;
  paid: boolean;
  planName?: string | null;
  runRateUsd?: number;
  children: AffiliateOrgChartSource[];
};

export type AffiliateOrgChartRow = {
  id: string;
  parentId: string | null;
  label: string;
  level: number;
  paid: boolean;
  planName?: string | null;
  runRateUsd?: number;
  childCount: number;
};

export type AffiliateOrgSearchHit = {
  id: string;
  label: string;
  level: number;
};

export function searchAffiliateOrgChart(
  rows: readonly Pick<AffiliateOrgChartRow, "id" | "label" | "level">[],
  query: string,
  limit = 8,
): AffiliateOrgSearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }
  return rows
    .map((row) => {
      const label = row.label.toLowerCase();
      const score = label === needle ? 0 : label.startsWith(needle) ? 1 : 2;
      return { row, score, label };
    })
    .filter((item) => item.label.includes(needle))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }
      return left.row.label.localeCompare(right.row.label);
    })
    .slice(0, limit)
    .map(({ row }) => ({
      id: row.id,
      label: row.label,
      level: row.level,
    }));
}

export function affiliateOrgPathToRoot(
  rows: readonly Pick<AffiliateOrgChartRow, "id" | "parentId">[],
  id: string,
): string[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const path: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    path.push(current.id);
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

export function flattenAffiliateOrgChart(
  nodes: readonly AffiliateOrgChartSource[],
  root: { planName?: string | null } = {},
): AffiliateOrgChartRow[] {
  const rows: AffiliateOrgChartRow[] = [
    {
      id: AFFILIATE_ORG_ROOT_ID,
      parentId: null,
      label: "You",
      level: 0,
      paid: true,
      planName: root.planName ?? null,
      runRateUsd: sumAffiliateOrgRunRate(nodes),
      childCount: nodes.length,
    },
  ];
  const walk = (node: AffiliateOrgChartSource, parentId: string) => {
    rows.push({
      id: node.userId,
      parentId,
      label: node.label,
      level: node.level,
      paid: node.paid,
      planName: node.planName ?? null,
      runRateUsd: node.runRateUsd ?? 0,
      childCount: node.children.length,
    });
    for (const child of node.children) {
      walk(child, node.userId);
    }
  };
  for (const node of nodes) {
    walk(node, AFFILIATE_ORG_ROOT_ID);
  }
  return rows;
}

export function escapeHtmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function affiliateOrgChartNodeHtml(
  row: AffiliateOrgChartRow,
  href: string | null,
  highlight?: { onPath?: boolean; selected?: boolean },
): string {
  const label = escapeHtmlText(row.label);
  const plan = escapeHtmlText(affiliateOrgPlanLabel(row.planName));
  const meta =
    row.level === 0 ? plan : `${plan} · L${row.level}`;
  const runRate = escapeHtmlText(
    affiliateOrgRunRateLabel(
      row.runRateUsd ?? 0,
      row.level === 0 ? "root" : "person",
    ),
  );
  const title = href
    ? `<a href="${escapeHtmlText(href)}" style="color:#F4F6F8;text-decoration:none">${label}</a>`
    : `<span style="color:#F4F6F8">${label}</span>`;
  const border = highlight?.selected
    ? "#8B6CF6"
    : highlight?.onPath || row.level === 0
      ? "#A78BFA"
      : "#2A313C";
  const borderWidth = highlight?.selected || highlight?.onPath ? 2 : 1;
  return `<div style="box-sizing:border-box;height:100%;padding:10px 12px;border:${borderWidth}px solid ${border};border-radius:8px;background:#1C222C;font-size:14px;line-height:1.25">
    <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${title}</div>
    <div style="margin-top:4px;color:#9AA3B2;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${meta}</div>
    <div style="margin-top:2px;color:#F4F6F8;font-size:12px;font-variant-numeric:tabular-nums">${runRate}</div>
  </div>`;
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
