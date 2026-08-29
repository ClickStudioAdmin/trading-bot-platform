import { MarketingHome } from "@/components/marketing-home";
import { redirectSignedInHome } from "@/lib/auth/onboarding";

export default async function Home() {
  await redirectSignedInHome();
  return <MarketingHome />;
}
