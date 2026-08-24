import type { Metadata } from "next";
import Link from "next/link";
import { ExchangeConnectForm } from "@/components/exchange-connect-form";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  formatAccountMode,
  formatConnectionRemoveBlockers,
} from "@/lib/accounts/model";
import { loadAccountUsage } from "@/lib/accounts/store";
import { removeExchangeConnection } from "@/lib/exchanges/actions";
import {
  formatEnvironmentLabel,
  formatVenueLabel,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { exchangeCredentialsConfigured } from "@/lib/exchanges/encrypt";
import {
  accountCanHoldConnections,
  enabledVenues,
} from "@/lib/exchanges/venues";
import { firstSearchValue } from "@/lib/paper/open";
import { getSessionContext } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Exchanges",
  description: "Connected exchanges.",
};

export default async function AccountExchangesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const params = await searchParams;
  const error = firstSearchValue(params.error);
  const saved = firstSearchValue(params.saved) === "1";
  const removed = firstSearchValue(params.removed) === "1";
  const live = accountCanHoldConnections(session.account.mode);
  const usage = live
    ? (await loadAccountUsage([session.account])).get(session.account.id)
    : null;
  const removeBlocks = usage?.connectionBlocks ?? [];
  const removeBlocked =
    removeBlocks.length > 0
      ? formatConnectionRemoveBlockers(removeBlocks)
      : null;
  const connections = live
    ? await listExchangeConnections(session.member.id, session.account.id)
    : [];
  const venues = enabledVenues();
  const canSave = live && exchangeCredentialsConfigured();

  return (
    <div>
      <PageHeading title="Exchanges" />
      <p className="-mt-4 mb-6 text-sm text-ink-muted">
        API keys belong to the current account, {session.account.name} (
        {formatAccountMode(session.account.mode)}). Switch accounts from the
        header to see another book.
      </p>
      {error ? (
        <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-success">Connection saved.</p>
      ) : null}
      {removed ? (
        <p className="text-sm text-success">Connection removed.</p>
      ) : null}

      {live && !canSave ? (
        <p className="mb-6 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Set <span className="font-mono text-ink">EXCHANGE_CREDENTIALS_KEY</span>{" "}
          on this Vercel environment (64 hex characters from{" "}
          <span className="font-mono text-ink">openssl rand -hex 32</span>),
          then redeploy. Use a Development key on <span className="font-mono text-ink">develop</span>
          — never the Production value. If the deployment badge says Preview,
          add the same Development key there too.
        </p>
      ) : null}

      {live ? (
        <>
          <ConnectionList rows={connections} removeBlocked={removeBlocked} />
          {canSave ? <ExchangeConnectForm venues={venues} /> : null}
        </>
      ) : (
        <p className="rounded-card border border-line bg-surface p-5 text-sm text-ink-muted">
          This is a Paper account. Exchange API keys belong on a Live account.{" "}
          <Link href="/account" className="text-accent hover:text-accent-strong">
            Manage sub-accounts
          </Link>{" "}
          to create or switch to Live.
        </p>
      )}
    </div>
  );
}

function ConnectionList({
  rows,
  removeBlocked,
}: {
  rows: ExchangeConnection[];
  removeBlocked: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-line bg-surface p-5 text-sm text-ink-muted">
        No exchanges connected on this account yet.
      </p>
    );
  }

  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold tracking-tight">Connected</h2>
      {removeBlocked ? (
        <p className="mt-2 text-sm text-ink-muted">
          {removeBlocked}. Turn on Reduce only in{" "}
          <Link
            href="/strategies/cash-and-carry/settings"
            className="text-accent hover:text-accent-strong"
          >
            Settings
          </Link>{" "}
          to stop new entries, flatten, then turn off{" "}
          <Link
            href="/strategies/cash-and-carry/automations"
            className="text-accent hover:text-accent-strong"
          >
            automations
          </Link>{" "}
          before removing a key.
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">
          You can remove a connection only while this account has no open
          positions and automations are off.
        </p>
      )}
      <ul className="mt-4 divide-y divide-line">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
          >
            <div>
              <p className="text-sm">
                {formatVenueLabel(row.venue)}
                {row.label ? (
                  <span className="ml-2 text-xs text-ink-muted">{row.label}</span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                {formatEnvironmentLabel(row.venue, row.environment)}
                {" · "}
                Key ••••{row.fingerprint}
                {row.status === "invalid" ? " · Invalid" : null}
              </p>
            </div>
            {removeBlocked ? (
              <p className="max-w-56 text-right text-xs text-ink-muted">
                {removeBlocked}
              </p>
            ) : (
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-control px-3 py-1.5 text-sm text-danger hover:bg-danger/10 [&::-webkit-details-marker]:hidden">
                  Remove
                </summary>
                <div className="absolute right-0 z-10 mt-2 w-64 rounded-card border border-line bg-surface p-3">
                  <p className="text-xs text-ink-muted">
                    Remove this connection? You can add the key again later.
                  </p>
                  <form action={removeExchangeConnection} className="mt-3">
                    <input type="hidden" name="connectionId" value={row.id} />
                    <PendingSubmitButton
                      pendingLabel="Removing"
                      successKey={`exchange-remove-${row.id}`}
                      className="rounded-control bg-danger px-3 py-1.5 text-sm font-medium text-ink"
                    >
                      Remove connection
                    </PendingSubmitButton>
                  </form>
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
