import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { switchTradingAccount } from "@/lib/accounts/actions";
import { formatAccountMode } from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import { getSessionContext } from "@/lib/auth/session";
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
  const current = session.account;
  const paperCount = accounts.filter((account) => account.mode === "paper").length;
  const liveCount = accounts.length - paperCount;

  return (
    <div className="space-y-8">
      <div>
        <PageHeading overline="Desk" title="Overview" />
        <p className="-mt-4 text-sm text-ink-muted">
          Login and books. Positions, automations, and keys live on the
          current book.
        </p>
      </div>

      <section>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Books"
            value={String(accounts.length)}
            hint={`${paperCount} Paper Trading · ${liveCount} Connected Exchange`}
            href="/account/sub-accounts"
          />
          <StatCard
            label="Current book"
            value={current.name}
            hint={formatAccountMode(current.mode)}
            href="/account/book"
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
          </dl>
          <Link
            href="/account/book"
            className="mt-4 inline-block text-sm text-accent hover:text-accent-strong"
          >
            Open book overview
          </Link>
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
            const isCurrent = account.id === current.id;
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

function formatCreated(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "—";
  }
  return new Date(ms).toISOString().slice(0, 10);
}
