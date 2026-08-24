import type { Metadata } from "next";
import Link from "next/link";
import { ExchangeConnectForm } from "@/components/exchange-connect-form";
import { PageHeading } from "@/components/page-heading";
import { RemoveConnectionControl } from "@/components/remove-connection-control";
import {
  formatAccountMode,
  connectionRemoveBlockers,
  formatConnectionRemoveBlockers,
} from "@/lib/accounts/model";
import { loadAccountUsage } from "@/lib/accounts/store";
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
  const boundId = usage?.strategyConnectionId ?? null;
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
          <ConnectionList
            rows={connections}
            boundId={boundId}
            accountName={session.account.name}
          />
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
  boundId,
  accountName,
}: {
  rows: ExchangeConnection[];
  boundId: string | null;
  accountName: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-line bg-surface p-5 text-sm text-ink-muted">
        No exchanges connected on this account yet.
      </p>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">Connected</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Keys belong to this account. Cash and Carry picks one in{" "}
        <Link
          href="/strategies/cash-and-carry/settings"
          className="text-accent hover:text-accent-strong"
        >
          Settings
        </Link>
        . You cannot remove a key while a strategy is using it.
      </p>
      <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Exchange</th>
              <th className="px-4 py-3 font-medium">
                Connected Accounts / Strategies
              </th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const inUse = boundId === row.id;
              const removeBlocked = formatConnectionRemoveBlockers(
                connectionRemoveBlockers({ inUse }),
              );
              return (
                <tr
                  key={row.id}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="px-4 py-3 align-top">
                    <p>{formatVenueLabel(row.venue)}</p>
                    {row.label ? (
                      <p className="mt-1 text-xs text-ink-muted">{row.label}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-ink-faint">
                      {formatEnvironmentLabel(row.venue, row.environment)}
                      {" · "}
                      Key ••••{row.fingerprint}
                      {row.status === "invalid" ? " · Invalid" : null}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p>{accountName}</p>
                    {inUse ? (
                      <p className="mt-1">
                        <Link
                          href="/strategies/cash-and-carry/settings"
                          className="text-xs text-accent hover:text-accent-strong"
                        >
                          Cash and Carry
                        </Link>
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-ink-faint">—</p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <RemoveConnectionControl
                      connectionId={row.id}
                      blockedMessage={inUse ? removeBlocked : null}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
