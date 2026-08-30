import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  DESK_HEADER,
  DESK_PATHNAME_HEADER,
  DESK_QUERY,
  DESK_SEARCH_HEADER,
  deskHomePath,
  deskUsesCashAndCarry,
  deskUsesPerpsUi,
  isDeskScopedPath,
  parseDeskQuery,
} from "@/lib/accounts/model";
import {
  getSessionContext,
  type SessionContext,
} from "@/lib/auth/session";

export async function pinDeskSearchParam(
  session: SessionContext,
): Promise<void> {
  const headerStore = await headers();
  const pathname = headerStore.get(DESK_PATHNAME_HEADER) ?? "";
  if (!isDeskScopedPath(pathname)) {
    return;
  }
  const urlDesk = parseDeskQuery(headerStore.get(DESK_HEADER));
  if (urlDesk === session.account.id) {
    return;
  }
  const params = new URLSearchParams(headerStore.get(DESK_SEARCH_HEADER) ?? "");
  params.set(DESK_QUERY, session.account.id);
  const query = params.toString();
  redirect(`${pathname}${query ? `?${query}` : ""}`);
}

export async function requireCashAndCarrySession(): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  if (!deskUsesCashAndCarry(session.account.deskType)) {
    redirect(deskHomePath(session.account.deskType, session.account.id));
  }
  return session;
}

export async function requirePerpsUiSession(): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  if (!deskUsesPerpsUi(session.account.deskType)) {
    redirect(deskHomePath(session.account.deskType, session.account.id));
  }
  return session;
}
