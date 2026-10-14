"use client";

import Link from "next/link";
import { IconArrowRight, IconWarning } from "@/components/icons";
import { useDeskTypeAccess } from "@/components/desk-type-access";
import { useQuotaAccess } from "@/components/quota-access";
import type { DeskType } from "@/lib/accounts/model";
import {
  deskTypeAccessFor,
  gateRejectLead,
  quotaAccessFor,
  type DeskTypeAccess,
  type QuotaAccess,
  type QuotaCapKey,
} from "@/lib/membership/entitlements";

export function DeskTypeRejectBanner({
  access,
}: {
  access: Pick<DeskTypeAccess, "allowed" | "message" | "upgradePlan">;
}) {
  if (access.allowed || !access.message) {
    return null;
  }
  const lead = gateRejectLead(access.message, access.upgradePlan);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-warning/30 bg-warning/10 px-4 py-3">
      <p className="flex min-w-0 flex-1 items-start gap-3 text-sm text-warning">
        <IconWarning size={18} className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{lead}</span>
      </p>
      {access.upgradePlan ? (
        <Link
          href="/account/plans"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          Upgrade to {access.upgradePlan}
          <IconArrowRight size={14} className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export function DeskTypeRejectNotices({
  deskTypes,
  serverError,
  className = "mb-4 space-y-3",
}: {
  deskTypes?: readonly DeskType[];
  serverError?: string | null;
  className?: string;
}) {
  const access = useDeskTypeAccess();
  const wanted = deskTypes
    ? deskTypes.flatMap((deskType) => {
        const row = deskTypeAccessFor(access, deskType);
        return row ? [row] : [];
      })
    : access;
  const seen = new Set<string>();
  const denied = wanted.filter((row) => {
    if (row.allowed || !row.message || seen.has(row.deskType)) {
      return false;
    }
    seen.add(row.deskType);
    return true;
  });
  const covered = new Set(denied.map((row) => row.message));
  const extra =
    serverError && !covered.has(serverError) ? serverError : null;
  if (denied.length === 0 && !extra) {
    return null;
  }
  return (
    <div className={className}>
      {denied.map((row) => (
        <DeskTypeRejectBanner key={row.deskType} access={row} />
      ))}
      {extra ? (
        <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {extra}
        </p>
      ) : null}
    </div>
  );
}

export function QuotaRejectNotices({
  keys,
  serverError,
  className = "mb-4 space-y-3",
}: {
  keys: readonly QuotaCapKey[];
  serverError?: string | null;
  className?: string;
}) {
  const access = useQuotaAccess();
  const rows = keys.flatMap((key) => {
    const row = quotaAccessFor(access, key);
    return row ? [row] : [];
  });
  return (
    <AccessRejectNotices
      rows={rows}
      serverError={serverError}
      className={className}
      rowKey={rejectNoticeKey}
    />
  );
}

export function PlanGateNotices({
  deskTypes,
  quotaKeys,
  serverError,
  className = "mb-4 space-y-3",
}: {
  deskTypes?: readonly DeskType[];
  quotaKeys?: readonly QuotaCapKey[];
  serverError?: string | null;
  className?: string;
}) {
  const deskAccess = useDeskTypeAccess();
  const quotaAccess = useQuotaAccess();
  const deskRows = deskTypes
    ? deskTypes.flatMap((deskType) => {
        const row = deskTypeAccessFor(deskAccess, deskType);
        return row ? [row] : [];
      })
    : deskAccess;
  const quotaRows = (quotaKeys ?? []).flatMap((key) => {
    const row = quotaAccessFor(quotaAccess, key);
    return row ? [row] : [];
  });
  return (
    <AccessRejectNotices
      rows={[...deskRows, ...quotaRows]}
      serverError={serverError}
      className={className}
      rowKey={rejectNoticeKey}
    />
  );
}

function rejectNoticeKey(row: DeskTypeAccess | QuotaAccess): string {
  return "deskType" in row ? row.deskType : row.key;
}

function AccessRejectNotices({
  rows,
  serverError,
  className,
  rowKey,
}: {
  rows: readonly (DeskTypeAccess | QuotaAccess)[];
  serverError?: string | null;
  className: string;
  rowKey: (row: DeskTypeAccess | QuotaAccess) => string;
}) {
  const seen = new Set<string>();
  const denied = rows.filter((row) => {
    const id = rowKey(row);
    if (row.allowed || !row.message || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
  const covered = new Set(denied.map((row) => row.message));
  const extra = serverError && !covered.has(serverError) ? serverError : null;
  if (denied.length === 0 && !extra) {
    return null;
  }
  return (
    <div className={className}>
      {denied.map((row) => (
        <DeskTypeRejectBanner key={rowKey(row)} access={row} />
      ))}
      {extra ? (
        <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {extra}
        </p>
      ) : null}
    </div>
  );
}
