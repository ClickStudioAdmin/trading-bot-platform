import { redirect } from "next/navigation";
import { listTradingAccounts } from "@/lib/accounts/store";
import { SIGN_IN_PATH } from "@/lib/auth/onboarding-path";
import { signedInHomePath } from "@/lib/auth/onboarding";
import { getSessionMember } from "@/lib/auth/session";

export default async function WelcomeRedirectPage() {
  const member = await getSessionMember();
  if (!member) {
    redirect(SIGN_IN_PATH);
  }
  redirect(signedInHomePath(member, await listTradingAccounts(member.id)));
}
