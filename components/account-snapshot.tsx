"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { AccountSnapshotView } from "@/lib/exchanges/account-view";
import {
  formatMarginModeLabel,
  formatSnapshotMoney,
  marginRateTone,
} from "@/lib/exchanges/account-view";
import { formatPct } from "@/lib/opportunities/format";

export function AccountSnapshotHover({
  snapshot,
  children,
}: {
  snapshot: AccountSnapshotView | null | undefined;
  children: ReactNode;
}) {
  const [box, setBox] = useState<DOMRect | null>(null);
  if (!snapshot) {
    return children;
  }

  return (
    <>
      <span
        className="block cursor-help"
        onMouseEnter={(event) =>
          setBox(event.currentTarget.getBoundingClientRect())
        }
        onMouseLeave={() => setBox(null)}
      >
        {children}
      </span>
      {box && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-50 w-64 rounded-control border border-line bg-surface-raised px-3 py-2 text-left text-xs font-normal normal-case tracking-normal"
              style={{
                top: box.bottom + 8,
                left: Math.max(12, Math.min(box.left, window.innerWidth - 280)),
              }}
            >
              <AccountSnapshotBody snapshot={snapshot} />
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

export function AccountSnapshotBody({
  snapshot,
}: {
  snapshot: AccountSnapshotView;
}) {
  if (!snapshot.ok) {
    return <p className="text-ink-muted">{snapshot.error}</p>;
  }
  const row = snapshot.snapshot;
  return (
    <dl className="space-y-1">
      <div className="flex justify-between gap-3">
        <dt className="text-ink-muted">Margin</dt>
        <dd className="text-ink">{formatMarginModeLabel(row.marginMode)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-ink-muted">Available</dt>
        <dd className="tabular-nums text-ink">
          {formatSnapshotMoney(row.availableBalance)}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-ink-muted">Balance</dt>
        <dd className="tabular-nums text-ink">
          {formatSnapshotMoney(row.marginBalance)}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-ink-muted">IM / MM</dt>
        <dd className="tabular-nums">
          <span className={marginRateTone(row.initialMarginRate)}>
            {formatPct(row.initialMarginRate)}
          </span>
          <span className="text-ink-faint"> / </span>
          <span className={marginRateTone(row.maintenanceMarginRate)}>
            {formatPct(row.maintenanceMarginRate)}
          </span>
        </dd>
      </div>
    </dl>
  );
}
