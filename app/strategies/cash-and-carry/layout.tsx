import { StrategySubnav } from "@/components/strategy-subnav";
import { getSessionContext } from "@/lib/auth/session";
import { loadPaperRules } from "@/lib/engine/load";
import { loadEngineSettings } from "@/lib/engine/settings";
import { formatStrategyConnectionCaption } from "@/lib/exchanges/connections";
import { loadAccountSnapshot } from "@/lib/exchanges/account-snapshot";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";

export default async function CashAndCarryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionContext();
  const { signedIn, config } = await loadPaperRules();
  const live = Boolean(session && accountCanHoldConnections(session.account.mode));
  const settings = live ? await loadEngineSettings() : null;
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
  const anyActive = config.layers.some(
    (layer) => (layer.mode ?? "active") === "active",
  );
  const anyLive = config.layers.some(
    (layer) => (layer.mode ?? "active") !== "disabled",
  );
  const accountReduce = Boolean(config.reduceOnly);
  const automationsOn = signedIn && anyLive;
  const engineRunning =
    automationsOn &&
    anyActive &&
    !accountReduce &&
    (!live || Boolean(bound));
  return (
    <div>
      <StrategySubnav
        automationsRunning={engineRunning}
        reduceOnly={automationsOn && (accountReduce || !anyActive)}
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
                      : "/strategies/cash-and-carry/settings",
                }
            : null
        }
      />
      {live && !bound ? (
        <div className="mx-auto max-w-7xl px-6 pt-4">
          <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            This is a Connected Exchange account. Bind an exchange in Strategy
            Settings before Open, Close, Unwind, or automations can place
            orders.
          </p>
        </div>
      ) : null}
      {children}
    </div>
  );
}
