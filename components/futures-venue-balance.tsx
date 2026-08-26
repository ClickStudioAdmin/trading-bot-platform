import type { ReactNode } from "react";
import type { AccountSnapshotView } from "@/lib/exchanges/account-view";
import {
  formatMarginModeLabel,
  formatSnapshotMoney,
  marginRateTone,
} from "@/lib/exchanges/account-view";
import { formatPct } from "@/lib/opportunities/format";

export function FuturesVenueBalance({
  snapshot,
}: {
  snapshot: AccountSnapshotView;
}) {
  if (!snapshot.ok) {
    return (
      <div className="mx-auto max-w-7xl px-6 pt-4">
        <div className="rounded-card border border-line bg-surface p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
            Venue account
          </p>
          <p className="mt-3 text-sm text-ink-muted">{snapshot.error}</p>
        </div>
      </div>
    );
  }

  const row = snapshot.snapshot;
  return (
    <div className="mx-auto max-w-7xl px-6 pt-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Available"
          value={formatSnapshotMoney(row.availableBalance)}
        />
        <StatCard
          label="Balance"
          value={formatSnapshotMoney(row.marginBalance)}
        />
        <StatCard
          label="IM / MM"
          value={
            <>
              <span className={marginRateTone(row.initialMarginRate)}>
                {formatPct(row.initialMarginRate)}
              </span>
              <span className="text-ink-faint"> / </span>
              <span className={marginRateTone(row.maintenanceMarginRate)}>
                {formatPct(row.maintenanceMarginRate)}
              </span>
            </>
          }
        />
        <StatCard
          label="Margin"
          value={formatMarginModeLabel(row.marginMode)}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-ink">
        {value}
      </p>
    </div>
  );
}
