import { MarketingHome } from "@/components/marketing-home";
import { listTradingAccounts } from "@/lib/accounts/store";
import { signedInHomePath } from "@/lib/auth/onboarding";
import { getSessionMember } from "@/lib/auth/session";

export default async function Home() {
  const member = await getSessionMember();
  const desks = member ? await listTradingAccounts(member.id) : [];
  const appHref = member ? signedInHomePath(member, desks) : null;
  return <MarketingHome appHref={appHref} />;
}
