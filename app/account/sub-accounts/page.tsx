import type { Metadata } from "next";
import Link from "next/link";
import { AccountDeleteControl } from "@/components/account-delete-control";
import { AccountExchangesPanel } from "@/components/account-exchanges-panel";
import { AccountRenameControl } from "@/components/account-rename-control";
import { DeskTypeMark } from "@/components/desk-mark";
import { PageHeading } from "@/components/page-heading";
import {
  AUTOMATED_DESK_TYPES,
  MANUAL_DESK_TYPES,
  formatAccountMode,
  formatAccountUsageStatus,
  formatDeskExchangeCaption,
  formatDeskNavLabel,
  formatDeleteBlockers,
  otherDeskNames,
  pickDefaultAccount,
  type DeskType,
  type TradingAccount,
} from "@/lib/accounts/model";
import {
  listTradingAccounts,
  loadAccountUsage,
  type AccountUsage,
} from "@/lib/accounts/store";
import { AFFILIATES_PATH } from "@/lib/auth/onboarding-path";
import { requireVerifiedEmail } from "@/lib/auth/session";
import { firstSearchValue } from "@/lib/paper/open";
import {
  ACCOUNT_DESKS_HREF,
  ACCOUNT_EXCHANGES_HREF,
} from "@/lib/site-links";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Manage Desks",
  description: "Rename and delete desks, and manage exchange keys.",
};

export default async function ManageSubAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await requireVerifiedEmail();
  if (!member.platformMember) {
    redirect(AFFILIATES_PATH);
  }
  const params = await searchParams;
  const tab = firstSearchValue(params.tab) === "exchanges" ? "exchanges" : "desks";
  const error = firstSearchValue(params.error);
  const deleted = firstSearchValue(params.deleted) === "1";
  const renamed = firstSearchValue(params.renamed) === "1";
  const saved = firstSearchValue(params.saved) === "1";
  const replaced = firstSearchValue(params.replaced) === "1";
  const removed = firstSearchValue(params.removed) === "1";

  return (
    <div>
      <PageHeading title="Manage Desks" />
      <nav
        aria-label="Manage Desks"
        className="mt-5 flex flex-wrap border-b border-line"
      >
        <TabLink href={ACCOUNT_DESKS_HREF} selected={tab === "desks"}>
          Desks
        </TabLink>
        <TabLink href={ACCOUNT_EXCHANGES_HREF} selected={tab === "exchanges"}>
          Exchanges
        </TabLink>
      </nav>
      {tab === "exchanges" ? (
        <div className="mt-6">
          <AccountExchangesPanel
            memberId={member.id}
            error={error}
            saved={saved}
            renamed={renamed}
            replaced={replaced}
            removed={removed}
          />
        </div>
      ) : (
        <DesksTab
          memberId={member.id}
          error={error}
          deleted={deleted}
          renamed={renamed}
        />
      )}
    </div>
  );
}

async function DesksTab({
  memberId,
  error,
  deleted,
  renamed,
}: {
  memberId: string;
  error?: string;
  deleted: boolean;
  renamed: boolean;
}) {
  const accounts = await listTradingAccounts(memberId);
  const usage = await loadAccountUsage(accounts);
  const currentId = pickDefaultAccount(accounts)?.id ?? "";

  return (
    <div className="mt-6">
      <p className="mb-6 text-sm text-ink-muted">
        Type and mode never change. Create a desk from the sidebar.
      </p>
      {error ? (
        <p className="mb-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {deleted ? (
        <p className="mb-6 text-sm text-success">Desk deleted.</p>
      ) : null}
      {renamed ? (
        <p className="mb-6 text-sm text-success">Desk renamed.</p>
      ) : null}

      {accounts.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No desks yet. Create one from the sidebar.
        </p>
      ) : (
        <>
          <DeskTypeSections
            label="Automated desks"
            types={AUTOMATED_DESK_TYPES}
            accounts={accounts}
            usage={usage}
            currentId={currentId}
          />
          <DeskTypeSections
            label="Manual trading desks"
            types={MANUAL_DESK_TYPES}
            accounts={accounts}
            usage={usage}
            currentId={currentId}
            hideTypeHeading
          />
        </>
      )}
    </div>
  );
}

function TabLink({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        selected
          ? "border-accent text-ink"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function DeskTypeSections({
  label,
  types,
  accounts,
  usage,
  currentId,
  hideTypeHeading = false,
}: {
  label: string;
  types: readonly DeskType[];
  accounts: TradingAccount[];
  usage: Map<string, AccountUsage>;
  currentId: string;
  hideTypeHeading?: boolean;
}) {
  const groups = types
    .map((deskType) => ({
      deskType,
      rows: accounts.filter((account) => account.deskType === deskType),
    }))
    .filter((group) => group.rows.length > 0);
  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 first:mt-0">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
        {label}
      </p>
      <div className="mt-4 space-y-6">
        {groups.map((group) => {
          const typeLabel = formatDeskNavLabel(group.deskType);
          return (
            <div key={group.deskType}>
              {hideTypeHeading ? null : (
                <h2 className="mb-4 flex items-center gap-2 text-2xl font-semibold tracking-tight">
                  <DeskTypeMark deskType={group.deskType} />
                  {typeLabel}
                </h2>
              )}
              <DeskTable
                accounts={group.rows}
                allAccounts={accounts}
                usage={usage}
                currentId={currentId}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DeskTable({
  accounts,
  allAccounts,
  usage,
  currentId,
}: {
  accounts: TradingAccount[];
  allAccounts: TradingAccount[];
  usage: Map<string, AccountUsage>;
  currentId: string;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[64rem] table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[14rem]" />
          <col className="w-[14rem]" />
          <col className="w-[16rem]" />
          <col />
          <col className="w-[11rem]" />
        </colgroup>
        <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
          <tr>
            <th className="px-4 py-3 pr-8 font-medium">Name</th>
            <th className="px-4 py-3 pr-8 font-medium">Mode</th>
            <th className="px-4 py-3 pr-8 font-medium">Exchange</th>
            <th className="px-4 py-3 pr-8 font-medium">Details</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => {
              const row = usage.get(account.id);
              const blocks = row?.blocks ?? [];
              const canDelete = blocks.length === 0;
              const current = account.id === currentId;
              const usageStatus = formatAccountUsageStatus({
                openCount: row?.openCount ?? 0,
                workingCount: row?.workingCount ?? 0,
                automationsRunning: Boolean(row?.automationsRunning),
                reduceOnly: Boolean(row?.reduceOnly),
              });
              const exchange = formatDeskExchangeCaption(
                account,
                Boolean(
                  row?.futuresConnectionId ?? row?.strategyConnectionId,
                ),
              );
              const remaining = allAccounts.filter(
                (item) => item.id !== account.id,
              );
              const defaultSwitch = pickDefaultAccount(remaining);
              return (
                <tr
                  key={account.id}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="px-4 py-3 pr-8 align-top">{account.name}</td>
                  <td className="px-4 py-3 pr-8 align-top text-ink-muted">
                    {formatAccountMode(account.mode)}
                  </td>
                  <td className="px-4 py-3 pr-8 align-top text-ink-muted">
                    {exchange ?? <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-4 py-3 pr-8 align-top">
                    {usageStatus ? (
                      <span className="text-ink-muted">{usageStatus}</span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap items-center gap-3">
                      <AccountRenameControl
                        accountId={account.id}
                        accountName={account.name}
                        otherNames={otherDeskNames(allAccounts, account.id)}
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
  );
}
