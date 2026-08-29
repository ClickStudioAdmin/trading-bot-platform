import { MarketingHome } from "@/components/marketing-home";
import { deskHomePath } from "@/lib/accounts/model";
import { WELCOME_PATH } from "@/lib/auth/onboarding-path";
import { getSessionContext, getSessionMember } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSessionContext();
  const member = session ? null : await getSessionMember();
  const appHref = session
    ? deskHomePath(session.account.deskType, session.account.id)
    : member
      ? WELCOME_PATH
      : null;
  return <MarketingHome appHref={appHref} />;
}
