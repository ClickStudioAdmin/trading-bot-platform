import type { Metadata } from "next";
import { AccountDeleteControl } from "@/components/account-delete-control";
import { AccountRenameControl } from "@/components/account-rename-control";
import { CreateAccountForm } from "@/components/create-account-form";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { switchTradingAccount } from "@/lib/accounts/actions";
import {
  formatAccountMode,
  formatAccountUsageStatus,
  formatDeskType,
  formatDeskVenueCaption,
  formatDeleteBlockers,
  otherDeskNames,
  pickDefaultAccount,
} from "@/lib/accounts/model";
import { listTradingAccounts, loadAccountUsage } from "@/lib/accounts/store";
import { connectionIdsBoundToOtherDesks } from "@/lib/exchanges/connections";
import {
  listConnectionDeskBinds,
  listExchangeConnections,
} from "@/lib/exchanges/store";
import { getSessionContext } from "@/lib/auth/session";
import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Manage desks",
  description: "Create and delete Paper Trading or Connected Exchange desks.",
};

const PATH = "/account/sub-accounts";

export default async function ManageSubAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const params = await searchParams;
  const error = firstSearchValue(params.error);
  const created = firstSearchValue(params.created) === "1";
  const deleted = firstSearchValue(params.deleted) === "1";
  const renamed = firstSearchValue(params.renamed) === "1";
  const accounts = await listTradingAccounts(session.member.id);
  const usage = await loadAccountUsage(accounts);
  const connections = await listExchangeConnections(session.member.id);
  const sharedConnectionIds = connectionIdsBoundToOtherDesks(
    await listConnectionDeskBinds(session.member.id),
  );

  return (
    <div>
      <PageHeading title="Manage desks" />
      <p className="-mt-4 mb-6 text-sm text-ink-muted">
        Each desk is Paper Trading or Connected Exchange at create and never
        changes. Type is also set at create. Books stay separate. You must keep
        at least one desk. You can rename a desk here or in Desk Settings.
        Delete is blocked
        while the book has open positions or running automations. Deleting a
        desk removes its paper history. Exchange keys stay on this login.
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {created ? (
        <p className="mt-4 text-sm text-success">Desk created.</p>
      ) : null}
      {deleted ? (
        <p className="mt-4 text-sm text-success">Desk deleted.</p>
      ) : null}
      {renamed ? (
        <p className="mt-4 text-sm text-success">Desk renamed.</p>
      ) : null}

      <section className="mt-6">
        <h2 className="text-lg font-semibold tracking-tight">Desks</h2>
        <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Desk type</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 font-medium">Exchange</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const row = usage.get(account.id);
                const blocks = row?.blocks ?? [];
                const canDelete = blocks.length === 0;
                const current = account.id === session.account.id;
                const usageStatus = formatAccountUsageStatus({
                  openCount: row?.openCount ?? 0,
                  automationsRunning: Boolean(row?.automationsRunning),
                  reduceOnly: Boolean(row?.reduceOnly),
                });
                const details = [
                  current ? "Current" : null,
                  usageStatus || null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const remaining = accounts.filter(
                  (item) => item.id !== account.id,
                );
                const defaultSwitch = pickDefaultAccount(remaining);
                return (
                  <tr
                    key={account.id}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className="px-4 py-3 align-top">
                      {formatDeskType(account.deskType)}
                    </td>
                    <td className="px-4 py-3 align-top">{account.name}</td>
                    <td className="px-4 py-3 align-top">
                      {formatAccountMode(account.mode)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {formatDeskVenueCaption(account)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {details ? (
                        <span className={current ? "text-accent" : "text-ink-muted"}>
                          {details}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap items-center gap-3">
                        {current ? null : (
                          <form action={switchTradingAccount}>
                            <input
                              type="hidden"
                              name="accountId"
                              value={account.id}
                            />
                            <input type="hidden" name="next" value={PATH} />
                            <PendingSubmitButton
                              pendingLabel="Switching…"
                              className="text-xs font-medium text-accent hover:text-accent-strong"
                            >
                              Switch to desk
                            </PendingSubmitButton>
                          </form>
                        )}
                        <AccountRenameControl
                          accountId={account.id}
                          accountName={account.name}
                          otherNames={otherDeskNames(accounts, account.id)}
                        />
                        <AccountDeleteControl
                          accountId={account.id}
                          accountName={account.name}
                          blockedMessage={
                            canDelete ? null : formatDeleteBlockers(blocks)
                          }
                          switchOptions={
                            current && canDelete
                              ? remaining.map((item) => ({
                                  id: item.id,
                                  name: item.name,
                                  mode: formatAccountMode(item.mode),
                                }))
                              : undefined
                          }
                          defaultSwitchId={
                            current && canDelete
                              ? defaultSwitch?.id
                              : undefined
                          }
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <CreateAccountForm
        connections={connections}
        sharedConnectionIds={sharedConnectionIds}
        existingNames={accounts.map((account) => account.name)}
        next="/account/sub-accounts"
      />
    </div>
  );
}
