import { StrategySubnav } from "@/components/strategy-subnav";
import { getSessionContext } from "@/lib/auth/session";
import { loadPaperRules } from "@/lib/engine/load";

export default async function CashAndCarryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionContext();
  const { signedIn, config } = await loadPaperRules();
  const automationsOn =
    signedIn && Boolean(config.enabled) && config.layers.length > 0;
  const paperRunning =
    automationsOn &&
    session?.account.mode === "paper" &&
    !config.reduceOnly;
  return (
    <div>
      <StrategySubnav
        automationsRunning={paperRunning}
        reduceOnly={automationsOn && Boolean(config.reduceOnly)}
      />
      {session?.account.mode === "live" ? (
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            This is a Live account. Rules stay here. The engine will not place
            paper fills or exchange orders until live execution exists.
          </p>
        </div>
      ) : null}
      {children}
    </div>
  );
}
