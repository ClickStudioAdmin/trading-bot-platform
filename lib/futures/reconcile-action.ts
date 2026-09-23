"use server";

import { getSessionContext } from "@/lib/auth/session";
import { reconcileOpenFuturesBooks } from "@/lib/futures/reconcile";

export async function reconcileDeskBookAction(): Promise<number> {
  const session = await getSessionContext();
  if (!session) {
    return 0;
  }
  return reconcileOpenFuturesBooks({
    accountId: session.account.id,
    userId: session.member.id,
  });
}
