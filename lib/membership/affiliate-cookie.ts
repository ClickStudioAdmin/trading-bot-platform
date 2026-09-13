import { cookies } from "next/headers";
import { parseAffiliateLinkSlug, parseOptionalReferralCode } from "./affiliate";

export const REFERRAL_COOKIE = "tbp_ref";
export const REFERRAL_LINK_COOKIE = "tbp_ref_link";

export function referralCookieOptions(days: number): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: days * 86_400,
  };
}

export async function readReferralCookie(): Promise<string | null> {
  try {
    const store = await cookies();
    const parsed = parseOptionalReferralCode(store.get(REFERRAL_COOKIE)?.value ?? "");
    return parsed.ok ? parsed.code : null;
  } catch {
    return null;
  }
}

export async function readReferralLinkCookie(): Promise<string | null> {
  try {
    const store = await cookies();
    const parsed = parseAffiliateLinkSlug(store.get(REFERRAL_LINK_COOKIE)?.value ?? "");
    return parsed.ok ? parsed.slug : null;
  } catch {
    return null;
  }
}

export async function clearReferralCookie(): Promise<void> {
  try {
    const store = await cookies();
    store.delete(REFERRAL_COOKIE);
    store.delete(REFERRAL_LINK_COOKIE);
  } catch {
    return;
  }
}
