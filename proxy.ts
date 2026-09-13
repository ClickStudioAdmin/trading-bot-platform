import {
  DESK_HEADER,
  DESK_PATHNAME_HEADER,
  DESK_QUERY,
  DESK_SEARCH_HEADER,
  parseDeskQuery,
} from "@/lib/accounts/model";
import { parseOptionalReferralCode } from "@/lib/membership/affiliate";
import {
  REFERRAL_COOKIE,
  referralCookieOptions,
} from "@/lib/membership/affiliate-cookie";
import { loadAffiliateCookieDays } from "@/lib/membership/affiliate-cookie-days";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(DESK_PATHNAME_HEADER, request.nextUrl.pathname);
  requestHeaders.set(
    DESK_SEARCH_HEADER,
    request.nextUrl.searchParams.toString(),
  );
  const desk = parseDeskQuery(request.nextUrl.searchParams.get(DESK_QUERY));
  if (desk) {
    requestHeaders.set(DESK_HEADER, desk);
  }
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  await captureFirstTouchReferral(request, response);
  return response;
}

async function captureFirstTouchReferral(
  request: NextRequest,
  response: NextResponse,
): Promise<void> {
  if (request.cookies.get(REFERRAL_COOKIE)?.value) {
    return;
  }
  const incoming = parseOptionalReferralCode(
    request.nextUrl.searchParams.get("ref") ??
      request.nextUrl.searchParams.get("referralCode"),
  );
  if (!incoming.ok || !incoming.code) {
    return;
  }
  const days = await loadAffiliateCookieDays();
  response.cookies.set(
    REFERRAL_COOKIE,
    incoming.code,
    referralCookieOptions(days),
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
