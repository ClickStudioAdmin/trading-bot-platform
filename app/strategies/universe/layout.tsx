import { UniverseSubnav } from "@/components/universe-subnav";

export default function UniverseStrategyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <UniverseSubnav />
      {children}
    </div>
  );
}
