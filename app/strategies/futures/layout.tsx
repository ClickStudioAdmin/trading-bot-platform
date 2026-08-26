import { FuturesVenueBalanceGate } from "@/components/futures-venue-balance-gate";
import { StrategySubnav } from "@/components/strategy-subnav";
import {
  deskHomePath,
  deskUsesPerpsUi,
  formatDeskType,
} from "@/lib/accounts/model";
import { dcaPlaybookIsRunning } from "@/lib/dca/playbook";
import { loadDcaPlaybook } from "@/lib/dca/store";
import { getSessionContext } from "@/lib/auth/session";
import { formatStrategyConnectionCaption } from "@/lib/exchanges/connections";
import { loadAccountSnapshot } from "@/lib/exchanges/account-snapshot";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { futuresDeskAutomationStatus } from "@/lib/futures/automation";
import { loadFuturesAutomationRules } from "@/lib/futures/automation-load";
import { loadFuturesSettings } from "@/lib/futures/settings";
import {
  FUTURES_PRIMARY_LINKS,
  FUTURES_SECONDARY_LINKS,
  SIGNAL_FOLLOWER_PRIMARY_LINKS,
} from "@/lib/site-links";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { redirect } from "next/navigation";

export default async function FuturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionContext();
  if (session && !deskUsesPerpsUi(session.account.deskType)) {
    redirect(deskHomePath(session.account.deskType));
  }
  const deskType = session?.account.deskType ?? "perps";
  const signalFollower = deskType === "signal_follower";
  const dca = deskType === "dca";
  const live = Boolean(session && accountCanHoldConnections(session.account.mode));
  const settings = session ? await loadFuturesSettings() : null;
  const rules = session
    ? await loadFuturesAutomationRules(session.account.id)
    : [];
  const connections =
    live && session
      ? await listExchangeConnections(session.member.id)
      : [];
  const bound =
    connections.find((row) => row.id === settings?.connectionId) ?? null;
  const snapshot =
    live && session && bound
      ? await loadAccountSnapshot(
          session.member.id,
          bound.id,
        )
      : null;
  const playbook =
    dca && session ? await loadDcaPlaybook(session.account.id) : null;
  const deskStatus = futuresDeskAutomationStatus({
    signedIn: Boolean(session),
    modes: rules.map((rule) => rule.mode),
    reduceOnly: Boolean(settings?.reduceOnly),
    liveBook: live,
    bound: Boolean(bound),
  });
  const automationsRunning = dca
    ? Boolean(playbook && dcaPlaybookIsRunning(playbook.status))
    : deskStatus.automationsRunning;
  return (
    <div>
      <StrategySubnav
        title={formatDeskType(deskType)}
        description={
          signalFollower
            ? "TradingView sends buy, sell, and close. This desk only protects: caps, reduce-only, Close All, and row TP/SL."
            : dca
              ? "This desk owns clips and exits. Arm from Automations or a Signal webhook. Close All and row TP/SL still protect."
              : "Buy, sell, or close one USDT linear perpetual. Market or limit. Long and short can both be open."
        }
        navLabel={formatDeskType(deskType)}
        primaryLinks={
          signalFollower
            ? SIGNAL_FOLLOWER_PRIMARY_LINKS
            : FUTURES_PRIMARY_LINKS
        }
        secondaryLinks={FUTURES_SECONDARY_LINKS}
        automationsHref={
          signalFollower ? FUTURES_PATHS.settings : FUTURES_PATHS.automations
        }
        automationsRunning={
          signalFollower ? false : automationsRunning
        }
        reduceOnly={deskStatus.reduceOnly}
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
            This is a Connected Exchange desk. Bind an exchange in Desk
            Settings before{" "}
            {signalFollower
              ? "TradingView orders can place."
              : dca
                ? "the playbook can place."
                : "Buy, Sell, or Close can place orders."}
          </p>
        </div>
      ) : null}
      {snapshot ? <FuturesVenueBalanceGate snapshot={snapshot} /> : null}
      {children}
    </div>
  );
}
