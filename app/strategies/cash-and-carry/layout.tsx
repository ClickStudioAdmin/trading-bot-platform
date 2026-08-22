import { StrategySubnav } from "@/components/strategy-subnav";

export default function CashAndCarryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <StrategySubnav />
      {children}
    </div>
  );
}
