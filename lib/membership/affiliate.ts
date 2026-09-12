import {
  AFFILIATE_LEVEL_MAX,
  AFFILIATE_RATE_KEYS,
  type AffiliateRateKey,
} from "./catalog";
import { isEvmAddress } from "./hd";
import { roundUsd } from "./wallet";

export const AFFILIATE_MAX_DEPTH_DEFAULT = 2;
export const AFFILIATE_HOLD_DAYS_DEFAULT = 30;
export const AFFILIATE_MIN_PAYOUT_DEFAULT = 50;
export const AFFILIATE_PAYOUT_COIN = "USDT";
export const AFFILIATE_NETWORKS_DEFAULT = [
  "ethereum",
  "arbitrum",
  "base",
  "polygon",
] as const;
export const DOWNGRADE_GRACE_DAYS_DEFAULT = 7;
export const REFERRAL_CODE_MIN = 4;
export const REFERRAL_CODE_MAX = 32;
export const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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

export type EnrollState = "enrolled" | "lost" | "never";

export type AffiliateProgramSettings = {
  maxDepth: number;
  holdDays: number;
  minPayoutUsd: number;
  payoutCoin: string;
  usdtNetworks: string[];
  downgradeGraceDays: number;
};

export const EMPTY_AFFILIATE_SETTINGS: AffiliateProgramSettings = {
  maxDepth: AFFILIATE_MAX_DEPTH_DEFAULT,
  holdDays: AFFILIATE_HOLD_DAYS_DEFAULT,
  minPayoutUsd: AFFILIATE_MIN_PAYOUT_DEFAULT,
  payoutCoin: AFFILIATE_PAYOUT_COIN,
  usdtNetworks: [...AFFILIATE_NETWORKS_DEFAULT],
  downgradeGraceDays: DOWNGRADE_GRACE_DAYS_DEFAULT,
};

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

export function parseUsdtNetworks(
  value: unknown,
): { ok: true; networks: string[] } | { ok: false; error: string } {
  const raw = Array.isArray(value)
    ? value.map((item) => String(item))
    : String(value ?? "").split(/[\s,]+/);
  const networks = [
    ...new Set(
      raw
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0),
    ),
  ];
  if (networks.length === 0) {
    return { ok: false, error: "Add at least one USDT network." };
  }
  if (
    networks.some(
      (item) => item.length < 2 || item.length > 32 || !/^[a-z0-9-]+$/.test(item),
    )
  ) {
    return {
      ok: false,
      error: "Networks use lowercase letters, numbers, and dashes.",
    };
  }
  return { ok: true, networks };
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

export function enrollState(input: {
  currentEnroll: boolean;
  lastEnrollPlanId: string | null;
}): EnrollState {
  if (input.currentEnroll) {
    return "enrolled";
  }
  return input.lastEnrollPlanId ? "lost" : "never";
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
  enrollState: EnrollState;
  arrears: boolean;
  payableUsd: number;
  minPayoutUsd: number;
}): { ok: true } | { ok: false; reason: string } {
  if (input.enrollState !== "enrolled") {
    return {
      ok: false,
      reason:
        input.enrollState === "lost"
          ? "Withdraw unlocks when affiliate enroll is on again."
          : "Upgrade to a plan with affiliate enroll to withdraw.",
    };
  }
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
    return { ok: false, error: "Pick a listed USDT network." };
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
  return `${base}/?ref=${encodeURIComponent(code)}`;
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
