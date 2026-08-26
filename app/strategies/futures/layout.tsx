import { FuturesVenueBalanceGate } from "@/components/futures-venue-balance-gate";
import { StrategySubnav } from "@/components/strategy-subnav";
import { getSessionContext } from "@/lib/auth/session";
import { formatStrategyConnectionCaption } from "@/lib/exchanges/connections";
import { loadAccountSnapshot } from "@/lib/exchanges/account-snapshot";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { loadFuturesSettings } from "@/lib/futures/settings";
import {
  FUTURES_PRIMARY_LINKS,
  FUTURES_SECONDARY_LINKS,
} from "@/lib/site-links";
import { FUTURES_PATHS } from "@/lib/strategies/registry";

export default async function FuturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionContext();
  const live = Boolean(session && accountCanHoldConnections(session.account.mode));
  const settings = session ? await loadFuturesSettings() : null;
  const connections =
    live && session
      ? await listExchangeConnections(session.member.id, session.account.id)
      : [];
  const bound =
    connections.find((row) => row.id === settings?.connectionId) ?? null;
  const snapshot =
    live && session && bound
      ? await loadAccountSnapshot(
          session.member.id,
          session.account.id,
          bound.id,
        )
      : null;
  return (
    <div>
      <StrategySubnav
        title="Futures"
        description="Buy, sell, or close one USDT linear perpetual. Market or limit. Long and short can both be open."
        navLabel="Futures"
        primaryLinks={FUTURES_PRIMARY_LINKS}
        secondaryLinks={FUTURES_SECONDARY_LINKS}
        automationsHref={FUTURES_PATHS.automations}
        reduceOnly={Boolean(settings?.reduceOnly)}
        connection={
          live
            ? bound
              ? {
                  ...formatStrategyConnectionCaption(bound),
                  connected: true,
                  snapshot,
                }
              : {
                  name: "Connect an exchange",
                  venue: null,
                  connected: false,
                  href:
                    connections.length === 0
                      ? "/account/exchanges"
                      : FUTURES_PATHS.settings,
                }
            : null
        }
      />
      {live && !bound ? (
        <div className="mx-auto max-w-7xl px-6 pt-4">
          <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            This is a Connected Exchange account. Bind an exchange in Strategy
            Settings before Buy, Sell, or Close can place orders.
          </p>
        </div>
      ) : null}
      {snapshot ? <FuturesVenueBalanceGate snapshot={snapshot} /> : null}
      {children}
    </div>
  );
}
