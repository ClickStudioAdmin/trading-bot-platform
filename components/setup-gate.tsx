import { SetupModal } from "@/components/setup-modal";
import { SetupWizard } from "@/components/setup-wizard";
import { listTradingAccounts } from "@/lib/accounts/store";
import { listOnboardingFolders } from "@/lib/onboarding/catalog";
import { emptySetupDraft } from "@/lib/onboarding/model";
import {
  loadMemberOnboarding,
  skipOnboardingForExternalDesk,
} from "@/lib/onboarding/store";
import { redirect } from "next/navigation";

export async function SetupGate({ userId }: { userId: string }) {
  const [accounts, folders, onboarding] = await Promise.all([
    listTradingAccounts(userId),
    listOnboardingFolders(),
    loadMemberOnboarding(userId),
  ]);
  const draftIds = new Set(
    (onboarding?.draft.desks ?? [])
      .map((desk) => desk.accountId)
      .filter((id): id is string => Boolean(id)),
  );
  const foreign = accounts.filter((account) => !draftIds.has(account.id));
  if (foreign.length > 0 && draftIds.size === 0) {
    await skipOnboardingForExternalDesk(userId);
    redirect("/account");
  }

  const draft = onboarding?.draft ?? emptySetupDraft();

  return (
    <SetupModal>
      <SetupWizard
        initialDraft={draft}
        existingNames={accounts
          .filter((account) => !draftIds.has(account.id))
          .map((account) => account.name)}
        folders={folders}
      />
    </SetupModal>
  );
}
