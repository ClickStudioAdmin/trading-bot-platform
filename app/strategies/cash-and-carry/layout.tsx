import { StrategySubnav } from "@/components/strategy-subnav";
import { getSessionContext } from "@/lib/auth/session";
import { loadPaperRules } from "@/lib/engine/load";
import { loadEngineSettings } from "@/lib/engine/settings";
import { formatConnectionSummary } from "@/lib/exchanges/connections";
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
      ? await listExchangeConnections(session.member.id, session.account.id)
      : [];
  const bound =
    connections.find((row) => row.id === settings?.connectionId) ?? null;
  const anyActive = config.layers.some(
    (layer) => (layer.mode ?? "active") === "active",
  );
  const anyLive = config.layers.some(
    (layer) => (layer.mode ?? "active") !== "disabled",
  );
  const accountReduce = Boolean(config.reduceOnly);
  const automationsOn = signedIn && anyLive;
  const paperRunning =
    automationsOn &&
    session?.account.mode === "paper" &&
    anyActive &&
    !accountReduce;
  return (
    <div>
      <StrategySubnav
        automationsRunning={paperRunning}
        reduceOnly={automationsOn && (accountReduce || !anyActive)}
        connection={
          live
            ? bound
              ? {
                  label: formatConnectionSummary(bound),
                  href: "/strategies/cash-and-carry/settings",
                }
              : {
                  label: "Connect an exchange to start trading",
                  href:
                    connections.length === 0
                      ? "/account/exchanges"
                      : "/strategies/cash-and-carry/settings",
                }
            : null
        }
      />
      {live ? (
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            This is a Live account. The engine will not place exchange
            orders until live execution exists.
          </p>
        </div>
      ) : null}
      {children}
    </div>
  );
}
