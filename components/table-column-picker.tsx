"use client";

import { useEffect, useRef } from "react";
import { AppCheck } from "@/components/app-check";

export function TableColumnPicker({
  columns,
  visible,
  onToggle,
  align = "end",
}: {
  columns: readonly { id: string; label: string }[];
  visible: Readonly<Record<string, boolean>>;
  onToggle: (id: string, on: boolean) => void;
  align?: "start" | "end";
}) {
  const rootRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeMenu() {
      if (rootRef.current) {
        rootRef.current.open = false;
      }
    }
    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (!root?.open) {
        return;
      }
      if (!root.contains(event.target as Node)) {
        closeMenu();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={rootRef} className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink [&::-webkit-details-marker]:hidden">
        Columns
      </summary>
      <div
        className={`absolute z-20 mt-2 w-56 rounded-card border border-line bg-surface p-2 ${
          align === "end" ? "right-0" : "left-0"
        }`}
      >
        <p className="px-2 pt-1 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
          Show columns
        </p>
        {columns.map((column) => (
          <label
            key={column.id}
            className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm text-ink hover:bg-surface-raised"
          >
            <AppCheck
              checked={visible[column.id] ?? false}
              onChange={(event) => onToggle(column.id, event.target.checked)}
              className=""
            />
            {column.label}
          </label>
        ))}
      </div>
    </details>
  );
}
