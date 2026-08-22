"use client";

import { useState } from "react";
import {
  formatNotionalInput,
  parseNotionalUsdt,
} from "@/lib/paper/open";

export function UsdtSizeInput({
  name,
  defaultValue,
  ariaLabel,
}: {
  name: string;
  defaultValue: number;
  ariaLabel: string;
}) {
  const [display, setDisplay] = useState(formatNotionalInput(String(defaultValue)));
  const parsed = parseNotionalUsdt(display);

  return (
    <span className="flex items-center gap-1 text-ink-muted">
      $
      <input type="hidden" name={name} value={parsed ?? ""} />
      <input
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        value={display}
        onChange={(event) => setDisplay(formatNotionalInput(event.target.value))}
        className="w-28 rounded-control border border-line bg-canvas px-2 py-1 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
      />
    </span>
  );
}
