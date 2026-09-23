import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountSnapshotBody } from "@/components/account-snapshot";
import { ContainerLoading } from "@/components/container-loading";
import { LocalTime } from "@/components/local-time";
import { PageHeading } from "@/components/page-heading";
import { listTradingAccounts } from "@/lib/accounts/store";
import { AFFILIATES_PATH } from "@/lib/auth/onboarding-path";
import { requireVerifiedEmail } from "@/lib/auth/session";
import { loadAccountSnapshots } from "@/lib/exchanges/account-snapshot";
import type { AccountSnapshotView } from "@/lib/exchanges/account-view";
import {
  formatStrategyConnectionCaption,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import {
  listConnectionDeskBinds,
  listExchangeConnections,
} from "@/lib/exchanges/store";
import {
  loadMemberNotificationChrome,
  memberOverviewAttention,
} from "@/lib/notifications/badges";
import { resolveInboxHref } from "@/lib/notifications/hrefs";
import { listUserNotifications } from "@/lib/notifications/store";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Overview",
  description: "Keys and desks on this login.",
};

export default async function AccountOverviewPage() {
  const member = await requireVerifiedEmail();
  if (!member.platformMember) {
    redirect(AFFILIATES_PATH);
  }
  const [accounts, connections, binds, chrome, notices] = await Promise.all([
    listTradingAccounts(member.id),
    listExchangeConnections(member.id),
    listConnectionDeskBinds(member.id),
    loadMemberNotificationChrome(member.id, true),
    listUserNotifications(member.id, 5),
  ]);
  const paperCount = accounts.filter((account) => account.mode === "paper").length;
  const liveCount = accounts.length - paperCount;
  const attention = memberOverviewAttention({
    accounts,
    binds,
    pastDue: chrome.actions.pastDue > 0,
    accountShortfall: chrome.actions.accountShortfall > 0,
    copyInvite: chrome.actions.copyInvite,
    updateCard: chrome.actions.updateCard > 0,
    deskCritical: chrome.actions.deskCritical,
  });

  return (
    <div className="space-y-8">
      <div>
        <PageHeading title="Overview" />
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Desks"
          value={String(accounts.length)}
          hint={`${paperCount} Paper Trading · ${liveCount} Connected Exchange`}
          href="/account/sub-accounts"
        />
        <div
          className={`rounded-card border p-5 ${
            attention.length > 0
              ? "border-warning/40 bg-surface"
              : "border-line bg-surface"
          }`}
        >
          <h2 className="text-lg font-semibold tracking-tight">Attention</h2>
          {attention.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Nothing needs attention.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {attention.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-warning hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Notices</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Recent inbox rows. Required-action counts stay on Attention until
              the work is done.
            </p>
          </div>
          <Link
            href="/account/notifications"
            className="text-sm text-accent hover:text-accent-strong"
          >
            Inbox
          </Link>
        </div>
        {notices.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No notices yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {notices.map((row) => (
              <li key={row.id} className="py-3 first:pt-0 last:pb-0">
                <Link
                  href={resolveInboxHref({
                    href: row.href,
                    title: row.title,
                    template: row.template,
                    desks: accounts,
                  })}
                  className={`text-sm hover:text-accent ${
                    row.readAt ? "text-ink-muted" : "text-ink"
                  }`}
                >
                  {row.title}
                </Link>
                <p className="mt-1 text-sm text-ink-muted">
                  <LocalTime at={row.createdAt} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Unified account
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Available, margin, and IM/MM on this login’s keys. Live desks
              bind one of these.
            </p>
          </div>
          <Link
            href="/account/sub-accounts?tab=exchanges"
            className="text-sm text-accent hover:text-accent-strong"
          >
            Exchanges
          </Link>
        </div>
        {connections.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            No keys on this login yet.
          </p>
        ) : (
          <Suspense
            fallback={<AccountKeyBalanceList connections={connections} />}
          >
            <AccountKeyBalances
              userId={member.id}
              connections={connections}
            />
          </Suspense>
        )}
      </section>
    </div>
  );
}

async function AccountKeyBalances({
  userId,
  connections,
}: {
  userId: string;
  connections: ExchangeConnection[];
}) {
  const snapshots = await loadAccountSnapshots(
    userId,
    connections.map((row) => row.id),
  );
  return (
    <AccountKeyBalanceList connections={connections} snapshots={snapshots} />
  );
}

function AccountKeyBalanceList({
  connections,
  snapshots,
}: {
  connections: ExchangeConnection[];
  snapshots?: Map<string, AccountSnapshotView>;
}) {
  return (
    <ul className="mt-4 divide-y divide-line">
      {connections.map((row) => (
        <li key={row.id} className="py-4 first:pt-0 last:pb-0">
          {snapshots ? (
            <ConnectionSnapshot
              row={row}
              snapshot={snapshots.get(row.id) ?? null}
            />
          ) : (
            <ConnectionBalancePending row={row} />
          )}
        </li>
      ))}
    </ul>
  );
}

function ConnectionBalancePending({ row }: { row: ExchangeConnection }) {
  const caption = formatStrategyConnectionCaption(row);
  return (
    <div>
      <p className="text-sm">
        {caption.name}
        {caption.venue ? (
          <span className="text-ink-muted"> ({caption.venue})</span>
        ) : null}
      </p>
      <div className="mt-2">
        <ContainerLoading label="Loading balance" />
      </div>
    </div>
  );
}

function ConnectionSnapshot({
  row,
  snapshot,
}: {
  row: ExchangeConnection;
  snapshot: AccountSnapshotView | null;
}) {
  const caption = formatStrategyConnectionCaption(row);
  return (
    <div>
      <p className="text-sm">
        {caption.name}
        {caption.venue ? (
          <span className="text-ink-muted"> ({caption.venue})</span>
        ) : null}
      </p>
      <div className="mt-2 max-w-xs text-sm">
        {snapshot ? (
          <AccountSnapshotBody snapshot={snapshot} />
        ) : (
          <p className="text-ink-muted">Could not read the unified account.</p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <p className="mt-3 truncate text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      <p className="mt-2 text-hint text-ink-muted">{hint}</p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="rounded-card border border-line bg-surface p-5 hover:border-line-strong"
      >
        {body}
      </Link>
    );
  }
  return (
    <div className="rounded-card border border-line bg-surface p-5">{body}</div>
  );
}
