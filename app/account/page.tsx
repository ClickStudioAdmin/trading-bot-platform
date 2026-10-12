import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountSnapshotBody } from "@/components/account-snapshot";
import {
  LiveAccountBalanceSummary,
  LiveMainWallet,
} from "@/components/crypto-wallet-panel";
import { DeskTypeMark } from "@/components/desk-mark";
import { IconCheck } from "@/components/icons";
import { PlanTrialHint, trialEmphasisClass } from "@/components/plan-trial-hint";
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
import {
  billingPath,
  memberSubscriptionSummary,
  type SubscriptionStatus,
} from "@/lib/membership/billing";
import { getMemberBilling } from "@/lib/membership/billing-store";
import { planIsArchived, type MembershipPlan } from "@/lib/membership/catalog";
import {
  overviewPlanGroups,
  type PlanOverviewGroup,
} from "@/lib/membership/plan-overview";
import { loadPlanUsageCounts } from "@/lib/membership/plan-usage";
import { getMembershipPlan } from "@/lib/membership/store";
import { ensureMemberTrialGrants } from "@/lib/membership/trial-store";
import type { MemberTrialGrant } from "@/lib/membership/trials";
import {
  pendingMainWithdrawUsd,
  walletBookBalances,
} from "@/lib/membership/wallet-store";
import { loadMemberNotificationChrome } from "@/lib/notifications/badges";
import { listMemberCriticalAccountIds } from "@/lib/notifications/critical";
import { resolveInboxHref } from "@/lib/notifications/hrefs";
import { listUserNotifications } from "@/lib/notifications/store";
import { dismissSetupSummary } from "@/lib/onboarding/actions";
import { shouldShowSummary } from "@/lib/onboarding/model";
import { loadMemberOnboarding } from "@/lib/onboarding/store";
import { formatPnlUsd } from "@/lib/opportunities/format";
import { ACCOUNT_DESKS_HREF, ACCOUNT_EXCHANGES_HREF } from "@/lib/site-links";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Overview",
  description: "Desks, positions, bots, billing, and keys on this login.",
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
  const [deskStats, planBundle, books, pendingWithdrawUsd, planUsage] =
    await Promise.all([
      loadFuturesDeskStats(futuresIds),
      billing?.planId
        ? loadPlanWithTrials(member.id, billing.planId)
        : Promise.resolve(null),
      billing ? walletBookBalances(member.id) : Promise.resolve(null),
      billing ? pendingMainWithdrawUsd(member.id) : Promise.resolve(0),
      billing
        ? loadPlanUsageCounts({
            userId: member.id,
            accountIds: accounts.map((account) => account.id),
            desks: accounts,
          })
        : Promise.resolve(null),
    ]);
  const planRecord = planBundle?.plan ?? null;
  const trialGrants = planBundle?.grants ?? [];
  const trialNowMs = planBundle?.nowMs ?? 0;
  const subscription = billing
    ? memberSubscriptionSummary({
        planName: planRecord?.name ?? null,
        archived: planRecord ? planIsArchived(planRecord) : false,
        priceUsd: planRecord?.priceUsd ?? null,
        method: billing.billingMethod,
        status: billing.subscriptionStatus,
        periodEnd: billing.periodEnd,
      })
    : null;
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
        <PageHeading title="Overview" tour="overview" />
      </div>
      {shouldShowSummary(onboarding?.draft.summary ?? null) &&
      onboarding?.draft.summary ? (
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">
            {onboarding.draft.summary.issues.length > 0
              ? "Setup finished with errors"
              : "Setup finished"}
          </h2>
          {onboarding.draft.summary.issues.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {onboarding.draft.summary.issues.map((issue) => (
                <li
                  key={`${issue.name}:${issue.message}`}
                  className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
                >
                  <span className="font-medium text-ink">{issue.name}</span>
                  {" — "}
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
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

      {subscription && books ? (
        <section className="grid items-start gap-4 lg:grid-cols-2">
          <div className="rounded-card border border-line bg-surface p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">
                Subscription Details
              </h2>
              <Link
                href="/account/billing"
                className="text-sm text-accent hover:text-accent-strong"
              >
                Billing & Account
              </Link>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Fact label="Current plan" value={subscription.plan} />
              <Fact
                label="Status"
                value={subscription.statusLabel}
                valueClass={subscriptionStatusClass(subscription.status)}
              />
              <Fact label="Monthly payment" value={subscription.price} />
              <Fact label="Payment method" value={subscription.method} />
              <Fact label="Next payment due" value={subscription.nextDue} />
            </div>
            <p className="mt-4">
              <Link
                href="/account/plans"
                className="text-sm text-accent hover:text-accent-strong"
              >
                Plans
              </Link>
            </p>
          </div>
          <div className="rounded-card border border-line bg-surface p-5">
            <LiveMainWallet
              initialMainUsd={books.main}
              initialPendingWithdrawUsd={pendingWithdrawUsd}
              pollBalance
            >
              <h2 className="text-lg font-semibold tracking-tight">
                Account Balance
              </h2>
              <LiveAccountBalanceSummary
                cycleDueUsd={planRecord?.priceUsd ?? 0}
              />
              <p className="mt-4">
                <Link
                  href={billingPath({ tab: "wallet" })}
                  className="text-sm text-accent hover:text-accent-strong"
                >
                  Manage Account Balance
                </Link>
              </p>
            </LiveMainWallet>
          </div>
        </section>
      ) : null}

      {planRecord && planUsage ? (
        <PlanPrivileges
          groups={overviewPlanGroups(planRecord, planUsage, {
            grants: trialGrants,
            nowMs: trialNowMs,
          })}
        />
      ) : null}

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

function PlanPrivileges({ groups }: { groups: PlanOverviewGroup[] }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold tracking-tight">
        Privileges and usage
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        What this plan includes, and how much of each maximum is in use.
      </p>
      <div className="mt-5 columns-1 gap-x-10 sm:columns-2 xl:columns-3">
        {groups.map((group) => (
          <div key={group.title} className="mb-6 break-inside-avoid">
            <h3 className="text-xs uppercase tracking-[0.12em] text-ink-muted">
              {group.title}
            </h3>
            <dl className="mt-2 space-y-1.5">
              {group.lines.map((line) => (
                <div key={line.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <dt className="text-ink">{line.label}</dt>
                    <dd
                      className={`tabular-nums ${
                        line.trial?.emphasize
                          ? ""
                          : line.over
                            ? "text-warning"
                            : "text-ink-muted"
                      }`}
                    >
                      {line.included ? (
                        <span
                          className="inline-flex text-success"
                          aria-label="Included"
                        >
                          <IconCheck size={16} className="size-4" />
                        </span>
                      ) : line.trial ? (
                        <PlanTrialHint
                          phase={line.trial.phase}
                          endsAt={line.trial.endsAt}
                          className={
                            line.trial.emphasize
                              ? trialEmphasisClass(line.trial.phase)
                              : undefined
                          }
                        >
                          {line.text}
                        </PlanTrialHint>
                      ) : (
                        line.text
                      )}
                    </dd>
                  </div>
                  {line.note ? (
                    <p className="text-hint text-ink-muted">{line.note}</p>
                  ) : null}
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

async function loadPlanWithTrials(
  userId: string,
  planId: string,
): Promise<{
  plan: MembershipPlan;
  grants: MemberTrialGrant[];
  nowMs: number;
} | null> {
  const loaded = await getMembershipPlan(planId);
  if (!loaded.ok) {
    return null;
  }
  const granted = await ensureMemberTrialGrants({
    userId,
    plan: loaded.plan,
  });
  return {
    plan: loaded.plan,
    grants: granted.ok ? granted.grants : [],
    nowMs: granted.ok ? granted.nowMs : 0,
  };
}

function subscriptionStatusClass(status: SubscriptionStatus | null): string {
  if (status === "past_due") {
    return "text-warning";
  }
  if (status === "canceled") {
    return "text-danger";
  }
  return "text-ink";
}

function Fact({
  label,
  value,
  valueClass = "text-ink",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <p className={`mt-1 text-sm ${valueClass}`}>{value}</p>
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
