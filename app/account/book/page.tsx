import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import {
  formatAccountMode,
  formatAccountUsageStatus,
} from "@/lib/accounts/model";
import { loadAccountUsage } from "@/lib/accounts/store";
import { getSessionContext } from "@/lib/auth/session";
import {
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
  const boundId = usage?.strategyConnectionId ?? null;
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
  const exchangeValue = live
    ? bound
      ? captionName(bound)
      : connections.length > 0
        ? "Unbound"
        : "None"
    : "Paper";
  const exchangeHint = live
    ? bound
      ? captionVenue(bound) ?? "Cash and Carry"
      : connections.length > 0
        ? "Not attached to Cash and Carry"
        : "Add a key to trade"
    : "Ledger only";

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
          <StatCard
            label="Exchange connection"
            value={exchangeValue}
            hint={exchangeHint}
            href="/account/exchanges"
          />
        </div>
      </section>

      {live && !bound ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          This is a Live account. The engine will not place exchange orders
          until an exchange connection is added.
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">This book</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Switch books from the header. Mode is set at create.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Name" value={current.name} />
            <Row label="Mode" value={formatAccountMode(current.mode)} />
            <Row label="Created" value={formatCreated(current.createdAtMs)} />
            <Row label="Status" value={usageStatus || "Idle"} />
          </dl>
        </div>

        <div className="rounded-card border border-line bg-surface p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
            Exchange Connection
          </p>
          {live ? (
            <ExchangeCard
              connections={connections}
              bound={bound}
            />
          ) : (
            <p className="mt-3 text-sm text-ink-muted">
              This is a Paper account. It uses the in-app ledger. Exchange keys
              belong on a Live book.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Shortcuts</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Shortcut
            href="/strategies/cash-and-carry/positions"
            label="Positions"
            hint="Open and closed carries"
          />
          <Shortcut
            href="/strategies/cash-and-carry/automations"
            label="Automations"
            hint="Sets and reduce only"
          />
          <Shortcut
            href="/account/exchanges"
            label="Exchange Connection"
            hint={live ? `${current.name} keys` : "Live books only"}
          />
          <Shortcut
            href="/strategies/cash-and-carry/settings"
            label="Strategy Settings"
            hint="Cash and Carry knobs"
          />
        </div>
      </section>
    </div>
  );
}

function ExchangeCard({
  connections,
  bound,
}: {
  connections: ExchangeConnection[];
  bound: ExchangeConnection | null;
}) {
  if (connections.length === 0) {
    return (
      <div className="mt-3">
        <p className="flex items-center gap-2 text-sm text-warning">
          <span className="size-2.5 shrink-0 rounded-full bg-warning" aria-hidden />
          Connect an exchange
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
  const caption = bound ? formatStrategyConnectionCaption(bound) : null;
  return (
    <div className="mt-3">
      <p className="flex items-center gap-2 text-sm text-ink">
        <span
          className={`size-2.5 shrink-0 rounded-full ${
            bound ? "bg-success" : "bg-warning"
          }`}
          aria-hidden
        />
        <span className="min-w-0 truncate">
          {caption ? (
            <>
              {caption.name}
              {caption.venue ? (
                <span className="text-ink-muted"> ({caption.venue})</span>
              ) : null}
            </>
          ) : (
            <span className="text-warning">Not attached to Cash and Carry</span>
          )}
        </span>
      </p>
      <p className="mt-2 text-xs text-ink-faint">
        {connections.length === 1
          ? "1 key on this book"
          : `${connections.length} keys on this book`}
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

function captionName(row: ExchangeConnection): string {
  return formatStrategyConnectionCaption(row).name;
}

function captionVenue(row: ExchangeConnection): string | null {
  return formatStrategyConnectionCaption(row).venue;
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
