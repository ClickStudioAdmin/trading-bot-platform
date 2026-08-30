import { deskHref } from "@/lib/accounts/model";
import { getSessionContext } from "@/lib/auth/session";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { redirect } from "next/navigation";

export default async function FuturesIndexPage() {
  const session = await getSessionContext();
  redirect(deskHref(FUTURES_PATHS.positions, session?.account.id));
}
