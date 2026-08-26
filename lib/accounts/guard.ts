import { redirect } from "next/navigation";
import {
  deskHomePath,
  deskUsesCashAndCarry,
  deskUsesPerpsUi,
} from "@/lib/accounts/model";
import {
  getSessionContext,
  type SessionContext,
} from "@/lib/auth/session";

export async function requireCashAndCarrySession(): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  if (!deskUsesCashAndCarry(session.account.deskType)) {
    redirect(deskHomePath(session.account.deskType));
  }
  return session;
}

export async function requirePerpsUiSession(): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  if (!deskUsesPerpsUi(session.account.deskType)) {
    redirect(deskHomePath(session.account.deskType));
  }
  return session;
}
