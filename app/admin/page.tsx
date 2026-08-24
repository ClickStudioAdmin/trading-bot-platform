import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { loadAdminOverview } from "@/lib/admin/overview";
import { formatScanAt } from "@/lib/opportunities/format";

export const metadata: Metadata = {
  title: "Admin overview",
  description: "Desk health, members, accounts, and recent issues.",
};

export default async function AdminOverviewPage() {
  const overview = await loadAdminOverview();

  return (
    <div className="space-y-8">
      <div>
        <PageHeading overline="Admin" title="Overview" />
        <p className="-mt-4 text-sm text-ink-muted">
          Desk snapshot. Paper books use the in-app ledger. Live books store
          their own rules; the tick does not execute them yet.
        </p>
      </div>

      {!overview.configured ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Auth is not configured on this environment, so counts are empty.
        </p>
      ) : null}

      <section>
        <h2 className="text-xl font-semibold tracking-tight">Desk</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Members"
            value={String(overview.members.total)}
            hint={`${overview.members.active} active · ${overview.members.admins} admin`}
            href="/admin/members"
          />
          <StatCard
            label="Accounts"
            value={String(overview.accounts.total)}
            hint={`${overview.accounts.paper} paper · ${overview.accounts.live} live`}
          />
          <StatCard
            label="Open paper"
            value={String(overview.positions.open)}
            hint={
              overview.positions.closing > 0
                ? `${overview.positions.closing} closing`
                : "No rows closing"
            }
          />
          <StatCard
            label="Automations on"
            value={String(overview.automations.running)}
            hint="Enabled books with at least one rule"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">Members</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Sign-in uses the members table, not Supabase Auth.
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

        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">Accounts</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Each book is Paper Trading or Connected Exchange at create and
            never changes.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Paper Trading" value={overview.accounts.paper} />
            <Row label="Connected Exchange" value={overview.accounts.live} />
            <Row
              label="Live execution"
              value="Off"
              tone="text-warning"
            />
          </dl>
          <p className="mt-4 text-xs text-ink-faint">
            The tick loops every account and skips Live. No exchange orders
            from this app.
          </p>
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Engine</h2>
        <p className="mt-1 text-sm text-ink-muted">
          One public Bybit scan per tick. Paper accounts apply their own rules.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
              Last tick
            </p>
            <p className="mt-1 tabular-nums">
              {overview.lastTick
                ? formatLogTime(overview.lastTick.at)
                : "—"}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              {overview.lastTick
                ? `${overview.lastTick.event} · ${overview.lastTick.message}`
                : "No tick events yet"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
              Last stored scan
            </p>
            <p className="mt-1 tabular-nums">
              {formatScanAt(overview.scan.lastAtMs)}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              {overview.scan.count} pair{overview.scan.count === 1 ? "" : "s"} in
              opportunities
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
                  {formatLogTime(issue.createdAt)}
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
          <Shortcut href="/admin/members" label="Members" hint="Desk logins" />
          <Shortcut href="/admin/logs" label="Logs" hint="System and trade events" />
          <Shortcut href="/admin/settings" label="Settings" hint="System knobs" />
          <Shortcut href="/admin/theme" label="Theme" hint="Visual reference" />
        </div>
      </section>
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

function formatLogTime(value: string): string {
  return `${value.slice(0, 19).replace("T", " ")} UTC`;
}
