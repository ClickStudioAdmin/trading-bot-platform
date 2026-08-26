import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AccountSnapshotBody } from "@/components/account-snapshot";
import { LocalTime } from "@/components/local-time";
import { PageHeading } from "@/components/page-heading";
import { formatAccountMode } from "@/lib/accounts/model";
import { loadAccountUsage } from "@/lib/accounts/store";
import { getSessionContext } from "@/lib/auth/session";
import { loadAccountSnapshots } from "@/lib/exchanges/account-snapshot";
import type { AccountSnapshotView } from "@/lib/exchanges/account-view";
import {
  formatEnvironmentLabel,
  formatStrategyConnectionCaption,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Book overview",
  description: "Positions, automations, and keys for the current book.",
};

export default async function BookOverviewPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const current = session.account;
  const usage = (await loadAccountUsage([current])).get(current.id);
  const live = accountCanHoldConnections(current.mode);
  const boundIds = [
    usage?.strategyConnectionId,
    usage?.futuresConnectionId,
  ].filter((id): id is string => Boolean(id));
  const connections = live
    ? (await listExchangeConnections(session.member.id)).filter((row) =>
        boundIds.includes(row.id),
      )
    : [];
  const snapshots = live
    ? await loadAccountSnapshots(
        session.member.id,
        connections.map((row) => row.id),
      )
    : new Map();
  const openCount = usage?.openCount ?? 0;
  const automationsRunning = Boolean(usage?.automationsRunning);
  const reduceOnly = Boolean(usage?.reduceOnly);
  const automationLabel = reduceOnly
    ? "Reduce only"
    : automationsRunning
      ? "On"
      : "Off";

  return (
    <div className="space-y-8">
      <div>
        <PageHeading overline={current.name} title="Overview" />
        <p className="-mt-4 text-sm text-ink-muted">
          This book is {formatAccountMode(current.mode)}. Positions and
          automations stay here. Keys belong to the login and bind on this
          book. Login and other books are on Desk.
        </p>
      </div>

      <section>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Open positions"
            value={String(openCount)}
            hint="Cash and Carry and Futures"
            href="/strategies"
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

      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">This book</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Switch books from the header. Mode is set at create.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Name" value={current.name} />
          <Row label="Mode" value={formatAccountMode(current.mode)} />
          <Row
            label="Created"
            value={<LocalTime at={current.createdAtMs} mode="date" />}
          />
        </dl>

        <div className="mt-6 border-t border-line pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">
                Exchange connections
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                This book binds a key from the login. Keys are managed on
                Exchanges.
              </p>
            </div>
            <Link
              href="/account/exchanges"
              className="text-sm text-accent hover:text-accent-strong"
            >
              Manage
            </Link>
          </div>
          {live ? (
            <ConnectionList rows={connections} snapshots={snapshots} />
          ) : (
            <p className="mt-4 text-sm text-ink-muted">
              Paper Trading uses the in-app ledger. Bind a key on a Connected
              Exchange book.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function ConnectionList({
  rows,
  snapshots,
}: {
  rows: ExchangeConnection[];
  snapshots: Map<string, AccountSnapshotView>;
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-4 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
        No key bound on this book yet. The engine will not place exchange
        orders until Desk Settings picks a key from this login.
      </p>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-line">
      {rows.map((row) => {
        const caption = formatStrategyConnectionCaption(row);
        const snapshot = snapshots.get(row.id) ?? null;
        return (
          <li key={row.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-sm">
                {caption.name}
                {caption.venue ? (
                  <span className="text-ink-muted"> ({caption.venue})</span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                {formatEnvironmentLabel(row.venue, row.environment)}
                {row.verifiedAtMs ? " · Verified" : null}
                {row.status === "invalid" ? " · Invalid" : null}
              </p>
              <div className="mt-2 max-w-xs text-sm">
                {snapshot ? (
                  <AccountSnapshotBody snapshot={snapshot} />
                ) : (
                  <p className="text-ink-muted">
                    Could not read the unified account.
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
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

function Row({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  );
}

