import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { loadAdminOverview } from "@/lib/admin/overview";
import { LocalTime } from "@/components/local-time";
import { formatDeskType } from "@/lib/accounts/model";

export const metadata: Metadata = {
  title: "Admin overview",
  description: "Logins, typed desks, engine health, and recent issues.",
};

export default async function AdminOverviewPage() {
  const overview = await loadAdminOverview();
  const openPositions =
    overview.positions.cashAndCarryOpen + overview.positions.perpsOpen;

  return (
    <div className="space-y-8">
      <div>
        <PageHeading overline="Admin" title="Overview" />
        <p className="-mt-4 text-sm text-ink-muted">
          Each login can have many desks. Type locks the manager. Paper Trading
          writes the in-app ledger. Connected Exchange desks bind a key from
          the login.
        </p>
      </div>

      {!overview.configured ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Auth is not configured on this environment, so counts are empty.
        </p>
      ) : null}

      <section>
        <h2 className="text-xl font-semibold tracking-tight">Snapshot</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Members"
            value={String(overview.members.total)}
            hint={`${overview.members.active} active · ${overview.members.admins} admin`}
            href="/admin/members"
          />
          <StatCard
            label="Desks"
            value={String(overview.desks.total)}
            hint={deskTypeHint(overview.desks)}
          />
          <StatCard
            label="Open positions"
            value={String(openPositions)}
            hint={openPositionHint(overview.positions)}
          />
          <StatCard
            label="Automations on"
            value={String(overview.automations.running)}
            hint={`${overview.automations.cashAndCarry} Cash and Carry · ${overview.automations.perps} Perps`}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">Desks</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Type and mode are set at create and never change. Two desks on one
            key still share venue margin.
          </p>
          <p className="mt-4 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
            Type
          </p>
          <dl className="mt-2 space-y-2 text-sm">
            <Row
              label={formatDeskType("cash_and_carry")}
              value={overview.desks.cashAndCarry}
            />
            <Row label={formatDeskType("perps")} value={overview.desks.perps} />
            <Row
              label={formatDeskType("signal_follower")}
              value={overview.desks.signalFollower}
            />
          </dl>
          <p className="mt-4 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
            Mode
          </p>
          <dl className="mt-2 space-y-2 text-sm">
            <Row label="Paper Trading" value={overview.desks.paper} />
            <Row label="Connected Exchange" value={overview.desks.live} />
            <Row label="Exchange keys" value={overview.keys.total} />
          </dl>
        </div>

        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">Members</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Invite-only logins. Sign-in uses the members table, not Supabase
            Auth.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Active" value={overview.members.active} />
            <Row label="Disabled" value={overview.members.disabled} />
            <Row label="Admins" value={overview.members.admins} />
          </dl>
          <Link
            href="/admin/members"
            className="mt-4 inline-block text-sm text-accent hover:text-accent-strong"
          >
            Manage members
          </Link>
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Engine</h2>
        <p className="mt-1 text-sm text-ink-muted">
          One public Bybit scan per tick. Cash and Carry automations run only
          on those desks. Perps price-cross recipes run on Perps desks.
          Signal follower desks take orders from TradingView only.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
              Last tick
            </p>
            <p className="mt-1 tabular-nums">
              {overview.lastTick ? (
                <LocalTime at={overview.lastTick.at} />
              ) : (
                "—"
              )}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              {overview.lastTick
                ? `${overview.lastTick.event} · ${overview.lastTick.message}`
                : "No tick events yet"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
              Last Cash and Carry scan
            </p>
            <p className="mt-1 tabular-nums">
              <LocalTime at={overview.scan.lastAtMs} mode="datetime-short" />
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              {overview.scan.count} pair
              {overview.scan.count === 1 ? "" : "s"} in opportunities
            </p>
          </div>
        </dl>
      </section>

      <section className="rounded-card border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Recent issues</h2>
          <Link
            href="/admin/logs?level=error"
            className="text-sm text-accent hover:text-accent-strong"
          >
            Open logs
          </Link>
        </div>
        {overview.issues.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            No warnings or errors in the latest events.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {overview.issues.map((issue) => (
              <li key={issue.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-xs tabular-nums text-ink-faint">
                  <LocalTime at={issue.createdAt} />
                  <span
                    className={`ml-2 ${
                      issue.level === "error" ? "text-danger" : "text-warning"
                    }`}
                  >
                    {issue.level}
                  </span>
                  <span className="ml-2 text-ink-muted">{issue.event}</span>
                </p>
                <p className="mt-1 text-sm">{issue.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Shortcuts</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Shortcut
            href="/admin/members"
            label="Members"
            hint="Invite-only logins"
          />
          <Shortcut
            href="/admin/logs"
            label="Logs"
            hint="System and trade events"
          />
          <Shortcut
            href="/admin/settings"
            label="Settings"
            hint="Auto tick"
          />
          <Shortcut href="/admin/theme" label="Theme" hint="Visual reference" />
        </div>
      </section>
    </div>
  );
}

function deskTypeHint(desks: {
  cashAndCarry: number;
  perps: number;
  signalFollower: number;
}): string {
  return `${desks.cashAndCarry} ${formatDeskType("cash_and_carry")} · ${desks.perps} ${formatDeskType("perps")} · ${desks.signalFollower} ${formatDeskType("signal_follower")}`;
}

function openPositionHint(positions: {
  cashAndCarryOpen: number;
  cashAndCarryClosing: number;
  perpsOpen: number;
}): string {
  const parts = [
    `${positions.cashAndCarryOpen} Cash and Carry`,
    `${positions.perpsOpen} Perps`,
  ];
  if (positions.cashAndCarryClosing > 0) {
    parts.push(`${positions.cashAndCarryClosing} closing`);
  }
  return parts.join(" · ");
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
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
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
  tone,
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`tabular-nums ${tone ?? ""}`}>{value}</dd>
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
