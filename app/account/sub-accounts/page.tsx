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
  formatDeleteBlockers,
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
        at least one desk. You can rename a desk any time. Delete is blocked
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

      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Desks</h2>
        <ul className="mt-4 divide-y divide-line">
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
            const remaining = accounts.filter((item) => item.id !== account.id);
            const defaultSwitch = pickDefaultAccount(remaining);
            return (
              <li
                key={account.id}
                className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm">
                    {account.name}
                    {current ? (
                      <span className="ml-2 text-xs text-accent">Current</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {formatDeskType(account.deskType)} ·{" "}
                    {formatAccountMode(account.mode)}
                    {usageStatus ? ` · ${usageStatus}` : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {current ? null : (
                    <form action={switchTradingAccount}>
                      <input type="hidden" name="accountId" value={account.id} />
                      <input type="hidden" name="next" value={PATH} />
                      <PendingSubmitButton
                        pendingLabel="Switching…"
                        className="rounded-control px-3 py-1.5 text-sm text-accent hover:bg-surface-raised"
                      >
                        Switch to desk
                      </PendingSubmitButton>
                    </form>
                  )}
                  <AccountRenameControl
                    accountId={account.id}
                    accountName={account.name}
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
                      current && canDelete ? defaultSwitch?.id : undefined
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <CreateAccountForm
        connections={connections}
        sharedConnectionIds={sharedConnectionIds}
        next="/account/sub-accounts"
      />
    </div>
  );
}
