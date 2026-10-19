import type { Metadata } from "next";
import { CreateAccountForm } from "@/components/create-account-form";
import { CreateDeskDetails } from "@/components/create-desk-details";
import { DeskCreatedNotice } from "@/components/desk-created-notice";
import { PlanGateNotices } from "@/components/desk-type-reject";
import { DESK_QUOTA_KEYS } from "@/lib/membership/entitlements";
import { PageHeading } from "@/components/page-heading";
import {
  createDeskPath,
  DEFAULT_DESK_TYPE,
  deskHomePath,
  formatDeskType,
  parseDeskCreateOrigin,
  parseDeskQuery,
  parseDeskTypeChoice,
} from "@/lib/accounts/model";
import { ACCOUNT_DESKS_HREF } from "@/lib/site-links";
import { listTradingAccounts } from "@/lib/accounts/store";
import { connectionIdsBoundToOtherDesks } from "@/lib/exchanges/connections";
import {
  listConnectionDeskBinds,
  listExchangeConnections,
} from "@/lib/exchanges/store";
import { memberIsAdmin } from "@/lib/admin/access";
import { exchangePreviewForLogin } from "@/lib/admin/emails";
import { loadExchangeAvailability } from "@/lib/exchanges/availability-store";
import { AFFILIATES_PATH } from "@/lib/auth/onboarding-path";
import { requireVerifiedEmail } from "@/lib/auth/session";
import { listOnboardingFolders } from "@/lib/onboarding/catalog";
import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "New desk",
  description: "Create a Paper Trading or Connected Exchange desk.",
};

export default async function NewDeskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await requireVerifiedEmail();
  if (!member.platformMember) {
    redirect(AFFILIATES_PATH);
  }
  const params = await searchParams;
  const origin = parseDeskCreateOrigin(firstSearchValue(params.from));
  const typed = parseDeskTypeChoice(firstSearchValue(params.type));
  if (!typed.ok) {
    redirect(createDeskPath(DEFAULT_DESK_TYPE, origin));
  }
  const error = firstSearchValue(params.error);
  const [accounts, exchangeCells, connections, starterFolders, binds] =
    await Promise.all([
      listTradingAccounts(member.id),
      loadExchangeAvailability(),
      listExchangeConnections(member.id),
      listOnboardingFolders(),
      listConnectionDeskBinds(member.id),
    ]);
  const createdId = parseDeskQuery(firstSearchValue(params.created));
  const created = createdId
    ? accounts.find((account) => account.id === createdId) ?? null
    : null;
  const sharedConnectionIds = connectionIdsBoundToOtherDesks(binds);

  return (
    <div>
      <PageHeading
        overline="Desks"
        title={
          created
            ? "Desk created"
            : `New ${formatDeskType(typed.deskType)} desk`
        }
      />
      <PlanGateNotices
        deskTypes={[typed.deskType]}
        quotaKeys={DESK_QUOTA_KEYS}
        serverError={created ? undefined : error}
      />
      {created ? (
        <div className="mt-6 max-w-xl">
          <DeskCreatedNotice
            origin={origin}
            deskHref={deskHomePath(created, created.id)}
            manageHref={ACCOUNT_DESKS_HREF}
            starterError={error}
          />
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <CreateAccountForm
            exchangeAccess={{
              preview: exchangePreviewForLogin(member),
              cells: exchangeCells,
            }}
            connections={connections}
            sharedConnectionIds={sharedConnectionIds}
            allowSharedKeys={memberIsAdmin(member)}
            existingNames={accounts.map((account) => account.name)}
            next={createDeskPath(typed.deskType, origin)}
            createFrom={origin}
            initialDeskType={typed.deskType}
            lockType
            hideTitle
            starterFolders={starterFolders}
          />
          <CreateDeskDetails deskType={typed.deskType} />
        </div>
      )}
    </div>
  );
}
