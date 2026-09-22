"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useThemePreviewPortalClass } from "@/components/theme-scheme-preview";
import type { CopyPaperEquityView } from "@/lib/copy/decide";
import { formatCopyPaperStartingUsdt } from "@/lib/copy/decide";
import {
  formatMarginModeWithLeverage,
  formatSnapshotMoney,
} from "@/lib/exchanges/account-view";

export function CopyPaperEquityHover({
  book,
  children,
}: {
  book: CopyPaperEquityView;
  children: ReactNode;
}) {
  const [box, setBox] = useState<DOMRect | null>(null);
  const previewClass = useThemePreviewPortalClass();

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
              className={`pointer-events-none fixed z-50 w-64 whitespace-normal rounded-control border border-line bg-surface-raised px-3 py-2 text-left text-hint font-normal normal-case tracking-normal text-ink ${previewClass}`.trim()}
              style={{
                top: box.bottom + 8,
                left: Math.max(12, Math.min(box.left, window.innerWidth - 280)),
              }}
            >
              <CopyPaperEquityBody book={book} />
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

export function CopyPaperEquityBody({ book }: { book: CopyPaperEquityView }) {
  return (
    <dl className="space-y-1 text-sm">
      <div className="flex justify-between gap-3">
        <dt className="text-xs uppercase tracking-[0.12em] text-ink-muted">Margin</dt>
        <dd className="text-ink">
          {formatMarginModeWithLeverage("cross", book.leverage)}
        </dd>
      </div>
      {book.startingUsdt > 0 ? (
        <div className="flex justify-between gap-3">
          <dt className="text-xs uppercase tracking-[0.12em] text-ink-muted">Started at</dt>
          <dd className="tabular-nums text-ink">
            {formatCopyPaperStartingUsdt(book.startingUsdt)}
          </dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-3">
        <dt className="text-xs uppercase tracking-[0.12em] text-ink-muted">Realized</dt>
        <dd className="tabular-nums text-ink">
          {formatSnapshotMoney(book.realizedUsdt)}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-xs uppercase tracking-[0.12em] text-ink-muted">Unrealized</dt>
        <dd className="tabular-nums text-ink">
          {formatSnapshotMoney(book.unrealizedUsdt)}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-xs uppercase tracking-[0.12em] text-ink-muted">Equity</dt>
        <dd className="tabular-nums text-ink">
          {formatSnapshotMoney(book.equityUsdt)}
        </dd>
      </div>
    </dl>
  );
}
