import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountSnapshotBody } from "@/components/account-snapshot";
import { DeskTypeMark } from "@/components/desk-mark";
import { ContainerLoading } from "@/components/container-loading";
import { LocalTime } from "@/components/local-time";
import { PageHeading } from "@/components/page-heading";
import {
  deskDisplayMode,
  deskHomePath,
  formatDeskCopyBadge,
  formatDeskDisplayModeHint,
  type DeskDisplayMode,
  type TradingAccount,
} from "@/lib/accounts/model";
import {
  desksInPlay,
  overviewBotsHint,
  overviewBoundDeskLabel,
  overviewDeskDetail,
  overviewDeskHint,
  overviewFocusHref,
  overviewKeyModeLabel,
  overviewOrdersHint,
  overviewPageAttention,
  overviewPositionsHint,
  overviewRealized30d,
  overviewStats,
  type OverviewDeskFacts,
} from "@/lib/accounts/overview";
import { listTradingAccounts, loadAccountUsage } from "@/lib/accounts/store";
import { AFFILIATES_PATH } from "@/lib/auth/onboarding-path";
import { requireVerifiedEmail } from "@/lib/auth/session";
import { loadFuturesDeskStats } from "@/lib/copy/desk-stats";
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
import { getMemberBilling } from "@/lib/membership/billing-store";
import { getMembershipPlan } from "@/lib/membership/store";
import { loadMemberNotificationChrome } from "@/lib/notifications/badges";
import { listMemberCriticalAccountIds } from "@/lib/notifications/critical";
import { resolveInboxHref } from "@/lib/notifications/hrefs";
import { listUserNotifications } from "@/lib/notifications/store";
import {
  dismissSetupSummary,
  startPlatformTour,
} from "@/lib/onboarding/actions";
import {
  shouldOfferTour,
  shouldShowSummary,
} from "@/lib/onboarding/model";
import { loadMemberOnboarding } from "@/lib/onboarding/store";
import { formatPnlUsd } from "@/lib/opportunities/format";
import { ACCOUNT_DESKS_HREF, ACCOUNT_EXCHANGES_HREF } from "@/lib/site-links";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Overview",
  description: "Desks, positions, bots, and keys on this login.",
};

const MODE_DOT: Record<DeskDisplayMode, string> = {
  paper: "bg-mode-paper",
  demo: "bg-mode-demo",
  live: "bg-mode-live",
};

export default async function AccountOverviewPage() {
  const member = await requireVerifiedEmail();
  if (!member.platformMember) {
    redirect(AFFILIATES_PATH);
  }
  const [accounts, connections, binds, chrome, notices, onboarding] =
    await Promise.all([
      listTradingAccounts(member.id),
      listExchangeConnections(member.id),
      listConnectionDeskBinds(member.id),
      loadMemberNotificationChrome(member.id, true),
      listUserNotifications(member.id, 5),
      loadMemberOnboarding(member.id),
    ]);
  const liveIds = accounts
    .filter((account) => account.mode === "live")
    .map((account) => account.id);
  const [usage, criticalIds, billing] = await Promise.all([
    loadAccountUsage(accounts),
    listMemberCriticalAccountIds(member.id, liveIds),
    getMemberBilling(member.id),
  ]);
  const critical = new Set(criticalIds);
  const rows: Array<OverviewDeskFacts & { account: TradingAccount }> =
    accounts.map((account) => {
      const row = usage.get(account.id);
      return {
        account,
        id: account.id,
        name: account.name,
        mode: account.mode,
        deskType: account.deskType,
        venueEnvironment: account.venueEnvironment,
        copy: Boolean(account.copyOfAccountId),
        openCount: row?.openCount ?? 0,
        carryOpenCount: row?.carryOpenCount ?? 0,
        futuresOpenCount: row?.futuresOpenCount ?? 0,
        workingCount: row?.workingCount ?? 0,
        botsOn: row?.botsOn ?? 0,
        reduceOnly: Boolean(row?.reduceOnly),
        bound: Boolean(row?.strategyConnectionId || row?.futuresConnectionId),
        critical: critical.has(account.id),
      };
    });
  const stats = overviewStats(rows);
  const inPlay = desksInPlay(rows);
  const futuresIds = inPlay
    .filter((desk) => desk.deskType !== "cash_and_carry")
    .map((desk) => desk.id);
  const [deskStats, plan] = await Promise.all([
    loadFuturesDeskStats(futuresIds),
    billing?.planId
      ? getMembershipPlan(billing.planId)
      : Promise.resolve(null),
  ]);
  const planName = plan?.ok ? plan.plan.name : null;
  const attention = overviewPageAttention({
    accounts,
    binds,
    pastDue: chrome.actions.pastDue > 0,
    accountShortfall: chrome.actions.accountShortfall > 0,
    copyInvite: chrome.actions.copyInvite,
    updateCard: chrome.actions.updateCard > 0,
    criticalIds,
  });

  return (
    <div className="space-y-8">
      <div>
        <PageHeading
          title="Overview"
          tour="overview"
          className={planName ? "mb-2" : undefined}
        />
        {planName ? (
          <p className="text-sm">
            <Link
              href="/account/billing"
              className="text-accent hover:text-accent-strong"
            >
              {planName}
            </Link>
          </p>
        ) : null}
      </div>
      {shouldShowSummary(onboarding?.draft.summary ?? null) &&
      onboarding?.draft.summary ? (
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">Setup finished</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            {onboarding.draft.summary.desks.map((row) => (
              <li key={`desk-${row.name}`}>
                {row.name}
                <span className="text-ink-muted"> — {row.detail}</span>
              </li>
            ))}
            {onboarding.draft.summary.bots.map((row) => (
              <li key={`bot-${row.name}-${row.detail}`}>
                {row.name}
                <span className="text-ink-muted"> — {row.detail}</span>
              </li>
            ))}
          </ul>
          <form action={dismissSetupSummary} className="mt-4">
            <button
              type="submit"
              className="rounded-control px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Dismiss
            </button>
          </form>
        </section>
      ) : null}
      {shouldOfferTour({
        platformMember: true,
        tour: onboarding?.tour ?? null,
      }) && onboarding?.tour !== "in_progress" ? (
        <form action={startPlatformTour}>
          <button
            type="submit"
            className="text-sm text-accent hover:text-accent-strong"
          >
            Take the tour
          </button>
        </form>
      ) : null}

      <section
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
                <Link href={item.href} className="text-warning hover:text-ink">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Trading now</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Desks"
            value={String(stats.desks)}
            hint={overviewDeskHint(stats)}
            href={ACCOUNT_DESKS_HREF}
          />
          <StatCard
            label="Open positions"
            value={String(stats.openPositions)}
            hint={overviewPositionsHint(stats)}
            href={overviewFocusHref("positions", rows)}
          />
          <StatCard
            label="Open orders"
            value={String(stats.openOrders)}
            hint={overviewOrdersHint(stats)}
            href={overviewFocusHref("orders", rows)}
          />
          <StatCard
            label="Bots on"
            value={String(stats.botsOn)}
            hint={overviewBotsHint(stats)}
            href={overviewFocusHref("bots", rows)}
          />
        </div>
      </section>

      <section
        id="desks-in-play"
        className="scroll-mt-20 rounded-card border border-line bg-surface p-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Desks in play</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Open positions, working orders, bots on, reduce only, a missing
              key, or a critical issue. 30d is closed-book dollars. Cash and
              Carry stays blank.
            </p>
          </div>
          <Link
            href={ACCOUNT_DESKS_HREF}
            className="text-sm text-accent hover:text-accent-strong"
          >
            Manage Desks
          </Link>
        </div>
        {accounts.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            No desks yet. Create one from the sidebar.
          </p>
        ) : inPlay.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">Every desk is idle.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {inPlay.map((desk) => {
              const realized = overviewRealized30d(
                desk.deskType,
                deskStats.get(desk.id)?.last30d.realizedUsdt,
              );
              const displayMode = deskDisplayMode(desk.account);
              const display = formatDeskDisplayModeHint(desk.account);
              const copy = formatDeskCopyBadge(desk.account);
              return (
                <li key={desk.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <DeskTypeMark deskType={desk.deskType} />
                    <Link
                      href={deskHomePath(desk.account, desk.account.id)}
                      className="text-sm text-ink hover:text-accent"
                    >
                      {desk.name}
                    </Link>
                    {copy ? (
                      <span className="rounded-control bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
                        {copy}
                      </span>
                    ) : null}
                    <span
                      title={display}
                      aria-hidden
                      className={`size-1.5 shrink-0 rounded-full ${MODE_DOT[displayMode]}`}
                    />
                    <span className="text-sm text-ink-muted">{display}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3 pl-6 text-sm">
                    <p className="text-ink-muted">{overviewDeskDetail(desk)}</p>
                    <p className="tabular-nums">
                      <span className="text-ink-muted">30d </span>
                      {realized == null ? (
                        <span className="text-ink-muted">—</span>
                      ) : (
                        <span className={realizedClass(realized)}>
                          {formatPnlUsd(realized)}
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
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
              Available, margin, and IM/MM on this login’s keys. Each live
              desk binds one key.
            </p>
          </div>
          <Link
            href={ACCOUNT_EXCHANGES_HREF}
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
            fallback={
              <AccountKeyBalanceList
                connections={connections}
                binds={binds}
                accounts={accounts}
              />
            }
          >
            <AccountKeyBalances
              userId={member.id}
              connections={connections}
              binds={binds}
              accounts={accounts}
            />
          </Suspense>
        )}
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
    </div>
  );
}

function realizedClass(value: number): string {
  if (value > 0) {
    return "text-success";
  }
  if (value < 0) {
    return "text-danger";
  }
  return "text-ink-muted";
}

async function AccountKeyBalances({
  userId,
  connections,
  binds,
  accounts,
}: {
  userId: string;
  connections: ExchangeConnection[];
  binds: readonly { connectionId: string; accountId: string }[];
  accounts: readonly { id: string; name: string }[];
}) {
  const snapshots = await loadAccountSnapshots(
    userId,
    connections.map((row) => row.id),
  );
  return (
    <AccountKeyBalanceList
      connections={connections}
      snapshots={snapshots}
      binds={binds}
      accounts={accounts}
    />
  );
}

function AccountKeyBalanceList({
  connections,
  snapshots,
  binds,
  accounts,
}: {
  connections: ExchangeConnection[];
  snapshots?: Map<string, AccountSnapshotView>;
  binds: readonly { connectionId: string; accountId: string }[];
  accounts: readonly { id: string; name: string }[];
}) {
  return (
    <ul className="mt-4 divide-y divide-line">
      {connections.map((row) => (
        <li key={row.id} className="py-4 first:pt-0 last:pb-0">
          {snapshots ? (
            <ConnectionSnapshot
              row={row}
              snapshot={snapshots.get(row.id) ?? null}
              binds={binds}
              accounts={accounts}
            />
          ) : (
            <ConnectionBalancePending
              row={row}
              binds={binds}
              accounts={accounts}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function ConnectionHeading({
  row,
  binds,
  accounts,
}: {
  row: ExchangeConnection;
  binds: readonly { connectionId: string; accountId: string }[];
  accounts: readonly { id: string; name: string }[];
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
      <p className="mt-1 text-sm text-ink-muted">
        {overviewKeyModeLabel(row.environment)}
        {" · "}
        {overviewBoundDeskLabel(row.id, binds, accounts)}
      </p>
      {row.status === "invalid" ? (
        <p className="mt-1 text-sm text-warning">Key failed verification.</p>
      ) : null}
    </div>
  );
}

function ConnectionBalancePending({
  row,
  binds,
  accounts,
}: {
  row: ExchangeConnection;
  binds: readonly { connectionId: string; accountId: string }[];
  accounts: readonly { id: string; name: string }[];
}) {
  return (
    <div>
      <ConnectionHeading row={row} binds={binds} accounts={accounts} />
      <div className="mt-2">
        <ContainerLoading label="Loading balance" />
      </div>
    </div>
  );
}

function ConnectionSnapshot({
  row,
  snapshot,
  binds,
  accounts,
}: {
  row: ExchangeConnection;
  snapshot: AccountSnapshotView | null;
  binds: readonly { connectionId: string; accountId: string }[];
  accounts: readonly { id: string; name: string }[];
}) {
  return (
    <div>
      <ConnectionHeading row={row} binds={binds} accounts={accounts} />
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
