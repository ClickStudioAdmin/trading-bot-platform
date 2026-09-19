"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { IconMoon, IconSun } from "@/components/icons";
import { useUiPreferences, useUiRegion } from "@/components/ui-preferences";
import type { ThemePreviewScheme } from "@/lib/theme/tokens";

const TOGGLE_ICON = { size: 14 as const, className: "size-3.5 shrink-0" };

const STORAGE_KEY = "tbp.admin-theme.scheme";

const ThemeSchemeContext = createContext<{
  scheme: ThemePreviewScheme;
  setScheme: (scheme: ThemePreviewScheme) => void;
  insidePreview: boolean;
}>({
  scheme: "dark",
  setScheme: () => {},
  insidePreview: false,
});

export function useThemePreviewScheme() {
  return useContext(ThemeSchemeContext);
}

export function themePreviewPortalClass(scheme: ThemePreviewScheme) {
  return scheme === "light" ? "theme-preview-light" : "";
}

export function useThemePreviewPortalClass() {
  const preview = useThemePreviewScheme();
  const prefs = useUiPreferences();
  const region = useUiRegion();
  if (preview.insidePreview) {
    return preview.scheme === "light" ? "theme-preview-light" : "theme-dark";
  }
  const scheme = region === "chrome" ? prefs.chrome : prefs.content;
  return scheme === "light" ? "theme-preview-light" : "";
}

export function ThemeSchemePreview({ children }: { children: ReactNode }) {
  const [scheme, setScheme] = useState<ThemePreviewScheme>("dark");

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      setScheme(saved);
    }
  }, []);

  function onScheme(next: ThemePreviewScheme) {
    setScheme(next);
    sessionStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <ThemeSchemeContext.Provider
      value={{ scheme, setScheme: onScheme, insidePreview: true }}
    >
      <div
        data-theme-preview={scheme}
        className={
          scheme === "light"
            ? "theme-preview-light theme-preview-canvas -mx-6 -my-8 min-h-dvh px-6 py-8"
            : "theme-dark theme-preview-canvas -mx-6 -my-8 min-h-dvh px-6 py-8"
        }
      >
        {children}
      </div>
    </ThemeSchemeContext.Provider>
  );
}

export function ThemeSchemeToggle() {
  const { scheme, setScheme } = useThemePreviewScheme();
  return (
    <div
      role="group"
      aria-label="Preview colour scheme"
      className="flex rounded-control border border-line p-0.5"
    >
      <SchemeButton
        label="Dark"
        selected={scheme === "dark"}
        onClick={() => setScheme("dark")}
        icon={<IconMoon {...TOGGLE_ICON} />}
      />
      <SchemeButton
        label="Light"
        selected={scheme === "light"}
        onClick={() => setScheme("light")}
        icon={<IconSun {...TOGGLE_ICON} />}
      />
    </div>
  );
}

function SchemeButton({
  label,
  selected,
  onClick,
  icon,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-control px-2.5 py-1 text-xs font-medium ${
        selected
          ? "bg-surface-raised text-ink"
          : "text-ink-muted hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
