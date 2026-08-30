import type { Metadata } from "next";
import { deskHomePath } from "@/lib/accounts/model";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { memberHasDesk } from "@/lib/auth/onboarding";
import { getSessionContext, getSessionMember } from "@/lib/auth/session";
import { connectionIdsBoundToOtherDesks } from "@/lib/exchanges/connections";
import {
  listConnectionDeskBinds,
  listExchangeConnections,
} from "@/lib/exchanges/store";
import { memberDisplayName } from "@/lib/members/sync";
import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Welcome",
  description: "Create your first desk.",
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  if (await memberHasDesk(member.id)) {
    const session = await getSessionContext();
    redirect(
      session
        ? deskHomePath(session.account.deskType, session.account.id)
        : "/strategies",
    );
  }

  const params = await searchParams;
  const error = firstSearchValue(params.error);
  const connections = await listExchangeConnections(member.id);
  const sharedConnectionIds = connectionIdsBoundToOtherDesks(
    await listConnectionDeskBinds(member.id),
  );

  return (
    <OnboardingWizard
      name={memberDisplayName(member.email, member.name)}
      connections={connections}
      sharedConnectionIds={sharedConnectionIds}
      error={error}
    />
  );
}
