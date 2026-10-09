import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { SetupWizard } from "@/components/setup-wizard";
import { listTradingAccounts } from "@/lib/accounts/store";
import { AFFILIATES_PATH } from "@/lib/auth/onboarding-path";
import { requireVerifiedEmail } from "@/lib/auth/session";
import { connectionIdsBoundToOtherDesks } from "@/lib/exchanges/connections";
import {
  listConnectionDeskBinds,
  listExchangeConnections,
} from "@/lib/exchanges/store";
import { listOnboardingFolders } from "@/lib/onboarding/catalog";
import { emptySetupDraft } from "@/lib/onboarding/model";
import {
  loadMemberOnboarding,
  skipOnboardingForExternalDesk,
} from "@/lib/onboarding/store";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Set up your account",
  description: "Create desks, connect exchanges, and load starter bots.",
};

export default async function SetupPage() {
  const member = await requireVerifiedEmail();
  if (!member.platformMember) {
    redirect(AFFILIATES_PATH);
  }
  const [accounts, connections, binds, folders, onboarding] = await Promise.all([
    listTradingAccounts(member.id),
    listExchangeConnections(member.id),
    listConnectionDeskBinds(member.id),
    listOnboardingFolders(),
    loadMemberOnboarding(member.id),
  ]);
  if (onboarding?.status === "skipped" || onboarding?.status === "completed") {
    redirect("/account");
  }
  const draftIds = new Set(
    (onboarding?.draft.desks ?? [])
      .map((desk) => desk.accountId)
      .filter((id): id is string => Boolean(id)),
  );
  const foreign = accounts.filter((account) => !draftIds.has(account.id));
  if (foreign.length > 0 && draftIds.size === 0) {
    await skipOnboardingForExternalDesk(member.id);
    redirect("/account");
  }

  const draft = onboarding?.draft.desks.length
    ? onboarding.draft
    : emptySetupDraft();

  return (
    <div>
      <PageHeading
        overline="Account"
        title="Set up your account"
      />
      <SetupWizard
        initialDraft={draft}
        existingNames={accounts
          .filter((account) => !draftIds.has(account.id))
          .map((account) => account.name)}
        connections={connections.map((row) => ({
          id: row.id,
          venue: row.venue,
          environment: row.environment,
          label: row.label,
          fingerprint: row.fingerprint,
          status: row.status,
        }))}
        sharedConnectionIds={connectionIdsBoundToOtherDesks(binds)}
        folders={folders}
      />
    </div>
  );
}
