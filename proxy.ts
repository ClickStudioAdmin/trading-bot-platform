import {
  DESK_HEADER,
  DESK_PATHNAME_HEADER,
  DESK_QUERY,
  DESK_SEARCH_HEADER,
  parseDeskQuery,
} from "@/lib/accounts/model";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
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
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
