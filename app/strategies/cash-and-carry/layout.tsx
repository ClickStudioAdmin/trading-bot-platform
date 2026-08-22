import { StrategySubnav } from "@/components/strategy-subnav";
import { loadPaperRules } from "@/lib/engine/load";

export default async function CashAndCarryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { signedIn, config } = await loadPaperRules();
  return (
    <div>
      <StrategySubnav
        automationsRunning={signedIn && config.layers.length > 0}
      />
      {children}
    </div>
  );
}
