import type { Metadata } from "next";
import Link from "next/link";
import { CreateAccountForm } from "@/components/create-account-form";
import { CreateDeskDetails } from "@/components/create-desk-details";
import { PageHeading } from "@/components/page-heading";
import {
  createDeskPath,
  DEFAULT_DESK_TYPE,
  formatDeskType,
  parseDeskTypeChoice,
} from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import { connectionIdsBoundToOtherDesks } from "@/lib/exchanges/connections";
import {
  listConnectionDeskBinds,
  listExchangeConnections,
} from "@/lib/exchanges/store";
import { getSessionContext } from "@/lib/auth/session";
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
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const params = await searchParams;
  const typed = parseDeskTypeChoice(firstSearchValue(params.type));
  if (!typed.ok) {
    redirect(createDeskPath(DEFAULT_DESK_TYPE));
  }
  const error = firstSearchValue(params.error);
  const accounts = await listTradingAccounts(session.member.id);
  const connections = await listExchangeConnections(session.member.id);
  const sharedConnectionIds = connectionIdsBoundToOtherDesks(
    await listConnectionDeskBinds(session.member.id),
  );

  return (
    <div>
      <PageHeading
        overline="Desks"
        title={`New ${formatDeskType(typed.deskType)} desk`}
      />
      {error ? (
        <p className="mb-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div>
          <CreateAccountForm
            connections={connections}
            sharedConnectionIds={sharedConnectionIds}
            existingNames={accounts.map((account) => account.name)}
            next={createDeskPath(typed.deskType)}
            initialDeskType={typed.deskType}
            lockType
            hideTitle
          />
          <p className="mt-4 text-sm text-ink-muted">
            Or{" "}
            <Link href="/account/sub-accounts" className="text-accent">
              manage existing desks
            </Link>
            .
          </p>
        </div>
        <CreateDeskDetails deskType={typed.deskType} />
      </div>
    </div>
  );
}
