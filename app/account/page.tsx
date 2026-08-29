import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AccountSnapshotBody } from "@/components/account-snapshot";
import { PageHeading } from "@/components/page-heading";
import { listTradingAccounts } from "@/lib/accounts/store";
import { getSessionContext } from "@/lib/auth/session";
import { loadAccountSnapshots } from "@/lib/exchanges/account-snapshot";
import type { AccountSnapshotView } from "@/lib/exchanges/account-view";
import {
  formatStrategyConnectionCaption,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Overview",
  description: "Desk login and the books you trade.",
};

export default async function AccountOverviewPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const accounts = await listTradingAccounts(session.member.id);
  const paperCount = accounts.filter((account) => account.mode === "paper").length;
  const liveCount = accounts.length - paperCount;
  const connections = await listExchangeConnections(session.member.id);
  const snapshots = await loadAccountSnapshots(
    session.member.id,
    connections.map((row) => row.id),
  );

  return (
    <div className="space-y-8">
      <div>
        <PageHeading overline="Desk" title="Overview" />
        <p className="-mt-4 text-sm text-ink-muted">
          Login and exchange keys for this account. Switch desks from the
          sidebar.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Desks"
          value={String(accounts.length)}
          hint={`${paperCount} Paper Trading · ${liveCount} Connected Exchange`}
          href="/account/sub-accounts"
        />
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
              href="/account/exchanges"
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
            <ul className="mt-4 divide-y divide-line">
              {connections.map((row) => (
                <li
                  key={row.id}
                  className="py-4 first:pt-0 last:pb-0"
                >
                  <ConnectionSnapshot
                    row={row}
                    snapshot={snapshots.get(row.id) ?? null}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
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

