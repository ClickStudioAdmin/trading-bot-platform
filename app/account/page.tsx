import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { switchTradingAccount } from "@/lib/accounts/actions";
import {
  formatAccountMode,
  formatAccountUsageStatus,
} from "@/lib/accounts/model";
import { listTradingAccounts, loadAccountUsage } from "@/lib/accounts/store";
import { getSessionContext } from "@/lib/auth/session";
import {
  formatConnectionSummary,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Overview",
  description: "Desk login and the current trading book.",
};

export default async function AccountOverviewPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const accounts = await listTradingAccounts(session.member.id);
  const usage = await loadAccountUsage(accounts);
  const current = session.account;
  const currentUsage = usage.get(current.id);
  const live = accountCanHoldConnections(current.mode);
  const connections = live
    ? await listExchangeConnections(session.member.id, current.id)
    : [];
  const paperCount = accounts.filter((account) => account.mode === "paper").length;
  const liveCount = accounts.length - paperCount;
  const openCount = currentUsage?.openCount ?? 0;
  const automationsRunning = Boolean(currentUsage?.automationsRunning);
  const reduceOnly = Boolean(currentUsage?.reduceOnly);
  const boundId = currentUsage?.strategyConnectionId ?? null;
  const bound = connections.find((row) => row.id === boundId) ?? null;
  const automationLabel = reduceOnly
    ? "Reduce only"
    : automationsRunning
      ? "On"
      : "Off";
  const usageStatus = formatAccountUsageStatus({
    openCount,
    automationsRunning,
    reduceOnly,
  });

  return (
    <div className="space-y-8">
      <div>
        <PageHeading title="Overview" />
        <p className="-mt-4 text-sm text-ink-muted">
          Desk login and the books you trade. The current book is {current.name}.
        </p>
      </div>

      <section>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Books"
            value={String(accounts.length)}
            hint={`${paperCount} paper · ${liveCount} live`}
            href="/account/sub-accounts"
          />
          <StatCard
            label="Current book"
            value={current.name}
            hint={formatAccountMode(current.mode)}
          />
          <StatCard
            label="Open positions"
            value={String(openCount)}
            hint="On this book"
            href="/strategies/cash-and-carry/positions"
          />
          <StatCard
            label="Automations"
            value={automationLabel}
            hint={
              reduceOnly
                ? "No new automated entries"
                : automationsRunning
                  ? "At least one set is on"
                  : "All sets off"
            }
            href="/strategies/cash-and-carry/automations"
          />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">Login</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Email is the desk sign-in. Name is what the header shows.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Name" value={session.member.name} />
            <Row label="Email" value={session.member.email} />
            <Row
              label="Role"
              value={session.member.role === "admin" ? "Admin" : "Member"}
            />
          </dl>
          <Link
            href="/account/settings"
            className="mt-4 inline-block text-sm text-accent hover:text-accent-strong"
          >
            Edit profile
          </Link>
        </div>

        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">Current book</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Switch books from the header or the list below. Mode never changes.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Name" value={current.name} />
            <Row label="Mode" value={formatAccountMode(current.mode)} />
            <Row label="Created" value={formatCreated(current.createdAtMs)} />
            <Row label="Status" value={usageStatus || "Idle"} />
          </dl>
          {live ? (
            <ExchangeStatus
              connections={connections}
              bound={bound}
              boundId={boundId}
            />
          ) : (
            <p className="mt-4 text-xs text-ink-faint">
              This is a Paper account. It uses the in-app ledger. Exchange keys
              belong on a Live book.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Books</h2>
          <Link
            href="/account/sub-accounts"
            className="text-sm text-accent hover:text-accent-strong"
          >
            Manage sub-accounts
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-line">
          {accounts.map((account) => {
            const row = usage.get(account.id);
            const isCurrent = account.id === current.id;
            const status = formatAccountUsageStatus({
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
                    {isCurrent ? (
                      <span className="ml-2 text-xs text-accent">Current</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {formatAccountMode(account.mode)}
                    {status ? ` · ${status}` : null}
                  </p>
                </div>
                {isCurrent ? null : (
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
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Shortcuts</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Shortcut
            href="/account/settings"
            label="Settings"
            hint="Name and password"
          />
          <Shortcut
            href="/account/sub-accounts"
            label="Manage sub-accounts"
            hint="Create, rename, delete"
          />
          <Shortcut
            href="/account/exchanges"
            label="Exchanges"
            hint={`${current.name} keys`}
          />
          <Shortcut
            href="/strategies/cash-and-carry"
            label="Cash and Carry"
            hint="Strategy desk"
          />
        </div>
      </section>
    </div>
  );
}

function ExchangeStatus({
  connections,
  bound,
  boundId,
}: {
  connections: ExchangeConnection[];
  bound: ExchangeConnection | null;
  boundId: string | null;
}) {
  if (connections.length === 0) {
    return (
      <p className="mt-4 text-xs text-ink-faint">
        No exchange connected. The engine will not place exchange orders until
        a key is added.{" "}
        <Link href="/account/exchanges" className="text-accent hover:text-accent-strong">
          Connect an exchange
        </Link>
      </p>
    );
  }
  return (
    <div className="mt-4">
      <p className="text-xs text-ink-faint">
        {connections.length === 1
          ? "1 exchange connected"
          : `${connections.length} exchanges connected`}
        {bound
          ? ` · Cash and Carry: ${formatConnectionSummary(bound)}`
          : boundId
            ? " · Cash and Carry bound"
            : " · Cash and Carry unbound"}
      </p>
      <Link
        href="/account/exchanges"
        className="mt-3 inline-block text-sm text-accent hover:text-accent-strong"
      >
        Open Exchanges
      </Link>
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
      <p className="mt-3 truncate text-2xl font-semibold tracking-tight">
        {value}
      </p>
      <p className="mt-2 text-xs text-ink-faint">{hint}</p>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  );
}

function Shortcut({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-card border border-line bg-surface p-4 hover:border-line-strong"
    >
      <p className="text-sm">{label}</p>
      <p className="mt-1 text-xs text-ink-faint">{hint}</p>
    </Link>
  );
}

function formatCreated(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "—";
  }
  return new Date(ms).toISOString().slice(0, 10);
}
