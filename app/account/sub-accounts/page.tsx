import type { Metadata } from "next";
import { AccountDeleteControl } from "@/components/account-delete-control";
import { AccountRenameControl } from "@/components/account-rename-control";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  createTradingAccount,
  switchTradingAccount,
} from "@/lib/accounts/actions";
import {
  formatAccountMode,
  formatAccountModeChoice,
  formatAccountUsageStatus,
  formatDeleteBlockers,
  pickDefaultAccount,
} from "@/lib/accounts/model";
import { listTradingAccounts, loadAccountUsage } from "@/lib/accounts/store";
import { getSessionContext } from "@/lib/auth/session";
import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Manage sub-accounts",
  description: "Create and delete Paper Trading or Connected Exchange accounts.",
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

  return (
    <div>
      <PageHeading title="Manage sub-accounts" />
      <p className="-mt-4 mb-6 text-sm text-ink-muted">
        Each account is Paper Trading or Connected Exchange at create and never
        changes. Books stay separate. You must keep at least one account. You
        can rename an account any time. Delete is blocked while the book has
        open positions or running automations. Deleting an account removes its
        paper history.
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {created ? (
        <p className="mt-4 text-sm text-success">Account created.</p>
      ) : null}
      {deleted ? (
        <p className="mt-4 text-sm text-success">Account deleted.</p>
      ) : null}
      {renamed ? (
        <p className="mt-4 text-sm text-success">Account renamed.</p>
      ) : null}

      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Accounts</h2>
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
                        Switch to account
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

      <form
        action={createTradingAccount}
        className="mt-6 space-y-4 rounded-card border border-line bg-surface p-5"
      >
        <h2 className="text-lg font-semibold tracking-tight">New account</h2>
        <input type="hidden" name="next" value={PATH} />
        <label className="block text-xs text-ink-muted">
          Name
          <input
            name="name"
            required
            maxLength={40}
            className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          />
        </label>
        <label className="block text-xs text-ink-muted">
          Mode
          <select
            name="mode"
            defaultValue="paper"
            className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          >
            <option value="paper">{formatAccountModeChoice("paper")}</option>
            <option value="live">{formatAccountModeChoice("live")}</option>
          </select>
        </label>
        <p className="text-sm text-ink-muted">
          Paper Trading uses live market data and fills on the in-app ledger.
          No real trades. Connected Exchange stores keys for a venue (Bybit
          Demo or production). Mode is set at create and never changes. This
          app places venue orders on that book when a key is bound.
        </p>
        <PendingSubmitButton
          pendingLabel="Creating…"
          className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          Create account
        </PendingSubmitButton>
      </form>
    </div>
  );
}
