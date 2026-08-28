import type { Metadata } from "next";
import Link from "next/link";
import { ExchangeConnectForm } from "@/components/exchange-connect-form";
import { PageHeading } from "@/components/page-heading";
import { RemoveConnectionControl } from "@/components/remove-connection-control";
import { ReplaceConnectionControl } from "@/components/replace-connection-control";
import {
  connectionRemoveBlockers,
  formatConnectionRemoveBlockers,
} from "@/lib/accounts/model";
import {
  formatDeskBindLabel,
  formatEnvironmentLabel,
  formatVenueLabel,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import {
  listConnectionDeskBinds,
  listExchangeConnections,
  type ConnectionDeskBind,
} from "@/lib/exchanges/store";
import { exchangeCredentialsConfigured } from "@/lib/exchanges/encrypt";
import { enabledVenues, getVenue } from "@/lib/exchanges/venues";
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
  const replaced = firstSearchValue(params.replaced) === "1";
  const removed = firstSearchValue(params.removed) === "1";
  const [connections, binds] = await Promise.all([
    listExchangeConnections(session.member.id),
    listConnectionDeskBinds(session.member.id),
  ]);
  const venues = enabledVenues();
  const canSave = exchangeCredentialsConfigured();

  return (
    <div>
      <PageHeading title="Exchanges" />
      <p className="-mt-4 mb-6 text-sm text-ink-muted">
        API keys belong to this login. Live desks bind one key. Paper desks
        do not use keys. The same key on two desks shares venue margin.
      </p>
      {error || saved || replaced || removed ? (
        <div className="mb-6 space-y-3">
          {error ? (
            <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="text-sm text-success">Connection saved.</p>
          ) : null}
          {replaced ? (
            <p className="text-sm text-success">
              Key replaced. Bound desks still use this connection.
            </p>
          ) : null}
          {removed ? (
            <p className="text-sm text-success">Connection removed.</p>
          ) : null}
        </div>
      ) : null}

      {!canSave ? (
        <p className="mb-6 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Set <span className="font-mono text-ink">EXCHANGE_CREDENTIALS_KEY</span>{" "}
          on this Vercel environment (64 hex characters from{" "}
          <span className="font-mono text-ink">openssl rand -hex 32</span>),
          then redeploy. Use a Development key on{" "}
          <span className="font-mono text-ink">develop</span>
          — never the Production value. If the deployment badge says Preview,
          add the same Development key there too.
        </p>
      ) : null}

      <ConnectionList
        rows={connections}
        binds={binds}
        currentAccountId={session.account.id}
        canReplace={canSave}
      />
      {canSave ? <ExchangeConnectForm venues={venues} /> : null}
    </div>
  );
}

function ConnectionList({
  rows,
  binds,
  currentAccountId,
  canReplace,
}: {
  rows: ExchangeConnection[];
  binds: ConnectionDeskBind[];
  currentAccountId: string;
  canReplace: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-line bg-surface p-5 text-sm text-ink-muted">
        No exchanges connected on this login yet.
      </p>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">Connected</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Live desks pick a key when you create them, or in Desk Settings.
        Replace key re-saves the API credentials on this connection. Desks
        stay bound. You cannot remove a key while any desk is using it.
      </p>
      <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Exchange</th>
              <th className="px-4 py-3 font-medium">Bound desks</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const used = binds.filter(
                (bind) => bind.connectionId === row.id,
              );
              const inUse = used.length > 0;
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
                      {row.verifiedAtMs ? " · Verified" : null}
                      {row.status === "invalid" ? " · Invalid" : null}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {used.length > 0 ? (
                      <span className="flex flex-col gap-1">
                        {used.map((bind) => {
                          const label = formatDeskBindLabel(bind);
                          const href =
                            bind.accountId === currentAccountId
                              ? bind.strategy === "futures"
                                ? "/strategies/futures/settings"
                                : "/strategies/cash-and-carry/settings"
                              : null;
                          return href ? (
                            <Link
                              key={`${bind.accountId}-${bind.strategy}`}
                              href={href}
                              className="text-accent hover:text-accent-strong"
                            >
                              {label}
                            </Link>
                          ) : (
                            <span
                              key={`${bind.accountId}-${bind.strategy}`}
                              className="text-ink-muted"
                            >
                              {label}
                            </span>
                          );
                        })}
                      </span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex justify-end gap-1">
                      {canReplace &&
                      (getVenue(row.venue)?.credentialFields.length ?? 0) >
                        0 ? (
                        <ReplaceConnectionControl
                          connectionId={row.id}
                          credentialFields={
                            getVenue(row.venue)?.credentialFields ?? []
                          }
                        />
                      ) : null}
                      <RemoveConnectionControl
                        connectionId={row.id}
                        blockedMessage={inUse ? removeBlocked : null}
                      />
                    </div>
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
