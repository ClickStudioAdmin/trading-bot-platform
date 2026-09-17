import { MarketingHome } from "@/components/marketing-home";
import { listTradingAccounts } from "@/lib/accounts/store";
import { signedInHomePath } from "@/lib/auth/onboarding";
import { getSessionMember } from "@/lib/auth/session";
import { loadPlatformName } from "@/lib/platform/brand";

export default async function Home() {
  const member = await getSessionMember();
  const desks = member ? await listTradingAccounts(member.id) : [];
  const appHref = member ? signedInHomePath(member, desks) : null;
  const platformName = await loadPlatformName();
  return <MarketingHome appHref={appHref} platformName={platformName} />;
}
