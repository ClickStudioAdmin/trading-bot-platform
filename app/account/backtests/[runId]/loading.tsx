import { ContainerLoading } from "@/components/container-loading";

export default function BacktestRunLoading() {
  return (
    <div className="space-y-6 pt-6">
      <ContainerLoading label="Opening this backtest" />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="h-48 rounded-card border border-line bg-surface" />
        <div className="h-48 rounded-card border border-line bg-surface" />
      </div>
    </div>
  );
}
