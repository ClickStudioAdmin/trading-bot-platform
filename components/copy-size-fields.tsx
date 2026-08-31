"use client";

import { useState } from "react";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import type { CopySizeMode } from "@/lib/copy/model";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function CopySizeFields({
  defaultMode = "balance",
  defaultPercent = "",
  defaultBookUsdt = "",
}: {
  defaultMode?: CopySizeMode;
  defaultPercent?: string;
  defaultBookUsdt?: string;
}) {
  const [sizeMode, setSizeMode] = useState<CopySizeMode>(defaultMode);
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm text-ink">Sizing</p>
        <p className="mt-1 text-xs text-ink-muted">
          Same formula every time: parent fill × (your book / their available).
          A $10,000 fill on a $100,000 book is 10% of whatever book you pick.
        </p>
      </div>
      <label className="block text-sm text-ink">
        How to size copies
        <select
          name="sizeMode"
          value={sizeMode}
          onChange={(event) =>
            setSizeMode(parseMode(event.target.value))
          }
          className={fieldClass}
        >
          <option value="balance">Account balance</option>
          <option value="percent">Percent of account balance</option>
          <option value="fixed">Fixed book</option>
        </select>
      </label>
      {sizeMode === "balance" ? (
        <p className="text-xs text-ink-muted">
          Your book is available USDT when the fill copies. Live reads the
          bound key. Paper uses the in-app ledger.
        </p>
      ) : null}
      {sizeMode === "percent" ? (
        <label className="block text-sm text-ink">
          Percent of account
          <span className="relative mt-1 block">
            <GroupedNumberInput
              name="sizePercent"
              defaultValue={defaultPercent}
              allowDecimal
              placeholder="20"
              ariaLabel="Percent of account"
              className="w-full rounded-control border border-line bg-surface-raised py-2 pr-8 pl-3 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-muted">
              %
            </span>
          </span>
          <span className="mt-1 block text-xs text-ink-muted">
            20% of a $10,000 account is a $2,000 book. That $10,000 parent
            fill becomes $200.
          </span>
        </label>
      ) : null}
      {sizeMode === "fixed" ? (
        <label className="block text-sm text-ink">
          Dummy book
          <span className="relative mt-1 block">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
              $
            </span>
            <GroupedNumberInput
              name="sizeBookUsdt"
              defaultValue={defaultBookUsdt}
              allowDecimal
              placeholder="5000"
              ariaLabel="Fixed book"
              className="w-full rounded-control border border-line bg-surface-raised py-2 pr-3 pl-7 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
            />
          </span>
          <span className="mt-1 block text-xs text-ink-muted">
            Treat this amount as your book. A $5,000 book turns that $10,000
            parent fill into $500. New copies pause if available drops below
            this amount.
          </span>
        </label>
      ) : null}
    </div>
  );
}

function parseMode(value: string): CopySizeMode {
  if (value === "percent" || value === "fixed") {
    return value;
  }
  return "balance";
}
