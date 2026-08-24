import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  createTradingAccount,
  deleteTradingAccount,
  renameTradingAccount,
  switchTradingAccount,
} from "@/lib/accounts/actions";
import {
  formatAccountMode,
  formatAccountUsageStatus,
  formatDeleteBlockers,
} from "@/lib/accounts/model";
import { listTradingAccounts, loadAccountUsage } from "@/lib/accounts/store";
import { getSessionContext } from "@/lib/auth/session";
import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Manage sub-accounts",
  description: "Create and delete Paper or Live trading accounts.",
};

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
        Each account is Paper or Live at create and never changes. Books stay
        separate. You must keep at least one account. You can rename an account
        any time. Delete is blocked while the book has open positions or
        running automations. Deleting an account removes its paper history.
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
                      <input type="hidden" name="next" value="/account" />
                      <PendingSubmitButton
                        pendingLabel="Switching…"
                        className="rounded-control px-3 py-1.5 text-sm text-accent hover:bg-surface-raised"
                      >
                        Switch to account
                      </PendingSubmitButton>
                    </form>
                  )}
                  <details className="relative">
                    <summary className="cursor-pointer list-none rounded-control px-3 py-1.5 text-sm text-accent hover:bg-surface-raised [&::-webkit-details-marker]:hidden">
                      Rename
                    </summary>
                    <div className="absolute right-0 z-10 mt-2 w-64 rounded-card border border-line bg-surface p-3">
                      <form action={renameTradingAccount} className="space-y-3">
                        <input type="hidden" name="accountId" value={account.id} />
                        <label className="block text-xs text-ink-muted">
                          Name
                          <input
                            name="name"
                            required
                            maxLength={40}
                            defaultValue={account.name}
                            className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
                          />
                        </label>
                        <PendingSubmitButton
                          pendingLabel="Saving"
                          successKey={`account-rename-${account.id}`}
                          className="rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
                        >
                          Save name
                        </PendingSubmitButton>
                      </form>
                    </div>
                  </details>
                  <details className="relative">
                    <summary className="cursor-pointer list-none rounded-control px-3 py-1.5 text-sm text-danger hover:bg-danger/10 [&::-webkit-details-marker]:hidden">
                      Delete
                    </summary>
                    <div className="absolute right-0 z-10 mt-2 w-64 rounded-card border border-line bg-surface p-3">
                      {canDelete ? (
                        <>
                          <p className="text-xs text-ink-muted">
                            Remove {account.name} and its closed history? This
                            cannot be undone.
                          </p>
                          <form action={deleteTradingAccount} className="mt-3">
                            <input
                              type="hidden"
                              name="accountId"
                              value={account.id}
                            />
                            <PendingSubmitButton
                              pendingLabel="Deleting…"
                              className="rounded-control bg-danger px-3 py-1.5 text-sm font-medium text-ink"
                            >
                              Delete account
                            </PendingSubmitButton>
                          </form>
                        </>
                      ) : (
                        <p className="text-xs text-ink-muted">
                          {formatDeleteBlockers(blocks)}.
                        </p>
                      )}
                    </div>
                  </details>
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
        <input type="hidden" name="next" value="/account" />
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
            <option value="paper">Paper</option>
            <option value="live">Live</option>
          </select>
        </label>
        <p className="text-sm text-ink-muted">
          Live accounts can store their own rules. This app will not place
          exchange orders until live execution exists.
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
