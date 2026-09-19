"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useThemePreviewPortalClass } from "@/components/theme-scheme-preview";

export function ColumnHint({
  label,
  hint,
}: {
  label: ReactNode;
  hint: ReactNode;
}) {
  const [box, setBox] = useState<DOMRect | null>(null);
  const held = useRef(false);
  const previewClass = useThemePreviewPortalClass();

  return (
    <>
      <span
        className="cursor-help"
        onMouseEnter={(event) => {
          if (held.current) {
            return;
          }
          setBox(event.currentTarget.getBoundingClientRect());
        }}
        onMouseLeave={() => {
          held.current = false;
          setBox(null);
        }}
        onPointerDown={() => {
          held.current = true;
          setBox(null);
        }}
      >
        {label}
      </span>
      {box && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              className={`pointer-events-none fixed z-50 w-72 rounded-control border border-line bg-surface-raised px-3 py-2 text-hint font-normal normal-case tracking-normal text-ink-muted ${previewClass}`.trim()}
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
