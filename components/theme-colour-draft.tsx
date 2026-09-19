"use client";

import { useThemePreviewScheme } from "@/components/theme-scheme-preview";
import { THEME_COLOURS } from "@/lib/theme/tokens";

export function ThemeColourDraft() {
  const { scheme } = useThemePreviewScheme();
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {THEME_COLOURS.map((colour) => (
        <div
          key={colour.name}
          className="flex gap-3 rounded-card border border-line bg-surface p-3"
        >
          <div
            className={`h-14 w-14 shrink-0 rounded-control border border-line ${colour.swatch}`}
          />
          <div className="min-w-0">
            <p className="font-medium">{colour.name}</p>
            <p className="font-mono text-xs text-ink-muted">
              {scheme === "light" ? colour.light : colour.dark}
            </p>
            <p className="mt-1 text-xs text-ink-faint">{colour.use}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
