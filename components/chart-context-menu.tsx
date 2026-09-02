"use client";

import { useEffect } from "react";

export type ChartContextMenuState = {
  x: number;
  y: number;
} | null;

export function ChartContextMenu({
  menu,
  onClose,
  onResetChart,
  onResetPrice,
}: {
  menu: ChartContextMenuState;
  onClose: () => void;
  onResetChart: () => void;
  onResetPrice: () => void;
}) {
  useEffect(() => {
    if (!menu) {
      return;
    }
    function close() {
      onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu, onClose]);

  if (!menu) {
    return null;
  }

  return (
    <div
      role="menu"
      className="fixed z-30 min-w-44 rounded-control border border-line bg-surface-raised py-1 shadow-none"
      style={{
        left: Math.min(menu.x, window.innerWidth - 188),
        top: Math.min(menu.y, window.innerHeight - 88),
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-surface"
        onClick={() => {
          onResetChart();
          onClose();
        }}
      >
        Reset chart
      </button>
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-surface"
        onClick={() => {
          onResetPrice();
          onClose();
        }}
      >
        Reset price scale
      </button>
    </div>
  );
}
