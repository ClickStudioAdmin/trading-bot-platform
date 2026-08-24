import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { formatAccountMode } from "@/lib/accounts/model";
import { loadAccountUsage } from "@/lib/accounts/store";
import { getSessionContext } from "@/lib/auth/session";
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
  const connections = live
    ? await listExchangeConnections(session.member.id, current.id)
    : [];
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
          This book is {formatAccountMode(current.mode)}. Positions, automations,
          and keys stay here. Login and other books are on Desk.
        </p>
      </div>

      <section>
        <div className="grid gap-4 sm:grid-cols-2">
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

      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">This book</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Switch books from the header. Mode is set at create.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Name" value={current.name} />
          <Row label="Mode" value={formatAccountMode(current.mode)} />
          <Row label="Created" value={formatCreated(current.createdAtMs)} />
        </dl>

        <div className="mt-6 border-t border-line pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">
                Exchange connections
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                Keys belong to this book. Strategies pick one when they trade.
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
            <ConnectionList rows={connections} />
          ) : (
            <p className="mt-4 text-sm text-ink-muted">
              Paper uses the in-app ledger. Exchange keys belong on a Live book.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function ConnectionList({ rows }: { rows: ExchangeConnection[] }) {
  if (rows.length === 0) {
    return (
      <p className="mt-4 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
        No keys on this book yet. The engine will not place exchange orders
        until a connection is added.
      </p>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-line">
      {rows.map((row) => {
        const caption = formatStrategyConnectionCaption(row);
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  );
}

function formatCreated(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "—";
  }
  return new Date(ms).toISOString().slice(0, 10);
}
