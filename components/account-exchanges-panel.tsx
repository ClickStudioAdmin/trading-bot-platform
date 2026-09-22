import { AccountConnectionsTable } from "@/components/account-connections-table";
import { ExchangeConnectForm } from "@/components/exchange-connect-form";
import {
  listConnectionDeskBinds,
  listExchangeConnections,
} from "@/lib/exchanges/store";
import { exchangeCredentialsConfigured } from "@/lib/exchanges/encrypt";
import { enabledVenues } from "@/lib/exchanges/venues";
import { loadExchangePairCounts } from "@/lib/pairs/page";
import { ACCOUNT_EXCHANGES_HREF } from "@/lib/site-links";

export async function AccountExchangesPanel({
  memberId,
  error,
  saved,
  renamed,
  replaced,
  removed,
}: {
  memberId: string;
  error?: string;
  saved?: boolean;
  renamed?: boolean;
  replaced?: boolean;
  removed?: boolean;
}) {
  const [connections, binds] = await Promise.all([
    listExchangeConnections(memberId),
    listConnectionDeskBinds(memberId),
  ]);
  const pairCounts = await loadExchangePairCounts(connections);
  const venues = enabledVenues();
  const canSave = exchangeCredentialsConfigured();

  return (
    <>
      {error || saved || renamed || replaced || removed ? (
        <div className="mb-6 space-y-3">
          {error ? (
            <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="text-sm text-success">Connection saved.</p>
          ) : null}
          {renamed ? (
            <p className="text-sm text-success">Connection renamed.</p>
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

      <AccountConnectionsTable
        rows={connections}
        binds={binds}
        pairCounts={pairCounts}
        canReplace={canSave}
      />
      {canSave ? (
        <ExchangeConnectForm venues={venues} next={ACCOUNT_EXCHANGES_HREF} />
      ) : null}
    </>
  );
}

