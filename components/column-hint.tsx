"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

export function ColumnHint({
  label,
  hint,
}: {
  label: string;
  hint: string;
}) {
  const [box, setBox] = useState<DOMRect | null>(null);

  return (
    <>
      <span
        className="cursor-help"
        onMouseEnter={(event) =>
          setBox(event.currentTarget.getBoundingClientRect())
        }
        onMouseLeave={() => setBox(null)}
      >
        {label}
      </span>
      {box && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-50 w-72 rounded-control border border-line bg-surface-raised px-3 py-2 text-xs font-normal normal-case tracking-normal text-ink-muted"
              style={{
                top: box.bottom + 8,
                left: Math.max(12, Math.min(box.left, window.innerWidth - 300)),
              }}
            >
              {hint}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
