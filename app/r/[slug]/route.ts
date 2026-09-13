import { affiliateLandingPath, parseAffiliateLinkSlug } from "@/lib/membership/affiliate";
import {
  REFERRAL_COOKIE,
  REFERRAL_LINK_COOKIE,
  referralCookieOptions,
} from "@/lib/membership/affiliate-cookie";
import { loadAffiliateCookieDays } from "@/lib/membership/affiliate-cookie-days";
import { findPublicAffiliateLink } from "@/lib/membership/affiliate-store";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await context.params;
  const parsed = parseAffiliateLinkSlug(raw);
  const fallback = new URL("/affiliates", request.url);
  if (!parsed.ok) {
    return NextResponse.redirect(fallback, 307);
  }
  const link = await findPublicAffiliateLink(parsed.slug);
  if (!link) {
    return NextResponse.redirect(fallback, 307);
  }
  const response = NextResponse.redirect(
    new URL(affiliateLandingPath(link.landing), request.url),
    307,
  );
  if (!request.cookies.get(REFERRAL_COOKIE)?.value) {
    const days = await loadAffiliateCookieDays();
    const options = referralCookieOptions(days);
    response.cookies.set(REFERRAL_COOKIE, link.code, options);
    response.cookies.set(REFERRAL_LINK_COOKIE, link.slug, options);
  }
  return response;
}
