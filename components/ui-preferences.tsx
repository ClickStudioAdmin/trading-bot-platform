"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { IconMoon, IconSun, IconUiPrefs } from "@/components/icons";
import { HEADER_CHIP_CLASS } from "@/components/site-nav";
import {
  UI_CHROME_COOKIE,
  UI_CONTENT_COOKIE,
  uiSchemeClass,
  writeUiSchemeCookie,
  type UiScheme,
  type UiThemeRegion,
} from "@/lib/theme/preferences";

const TOGGLE_ICON = { size: 14 as const, className: "size-3.5 shrink-0" };

const UiPreferencesContext = createContext<{
  chrome: UiScheme;
  content: UiScheme;
  setChrome: (scheme: UiScheme) => void;
  setContent: (scheme: UiScheme) => void;
  setBoth: (scheme: UiScheme) => void;
}>({
  chrome: "dark",
  content: "dark",
  setChrome: () => {},
  setContent: () => {},
  setBoth: () => {},
});

const UiRegionContext = createContext<UiThemeRegion | null>(null);

export function useUiPreferences() {
  return useContext(UiPreferencesContext);
}

export function useUiRegion() {
  return useContext(UiRegionContext);
}

export function UiPreferencesProvider({
  chrome,
  content,
  children,
}: {
  chrome: UiScheme;
  content: UiScheme;
  children: ReactNode;
}) {
  const [prefs, setPrefs] = useState({ chrome, content });

  function setChrome(scheme: UiScheme) {
    writeUiSchemeCookie(UI_CHROME_COOKIE, scheme);
    setPrefs((current) => ({ ...current, chrome: scheme }));
  }

  function setContent(scheme: UiScheme) {
    writeUiSchemeCookie(UI_CONTENT_COOKIE, scheme);
    setPrefs((current) => ({ ...current, content: scheme }));
  }

  function setBoth(scheme: UiScheme) {
    writeUiSchemeCookie(UI_CHROME_COOKIE, scheme);
    writeUiSchemeCookie(UI_CONTENT_COOKIE, scheme);
    setPrefs({ chrome: scheme, content: scheme });
  }

  return (
    <UiPreferencesContext.Provider
      value={{
        chrome: prefs.chrome,
        content: prefs.content,
        setChrome,
        setContent,
        setBoth,
      }}
    >
      {children}
    </UiPreferencesContext.Provider>
  );
}

export function UiRegion({
  region,
  children,
  className = "",
}: {
  region: UiThemeRegion;
  children: ReactNode;
  className?: string;
}) {
  const prefs = useUiPreferences();
  const scheme = prefs[region];
  return (
    <UiRegionContext.Provider value={region}>
      <div
        data-ui-region={region}
        className={`bg-canvas text-ink ${uiSchemeClass(scheme)} ${className}`.trim()}
      >
        {children}
      </div>
    </UiRegionContext.Provider>
  );
}

export function UiPreferencesMenu() {
  const { chrome, content, setChrome, setContent, setBoth } =
    useUiPreferences();
  const both = chrome === content ? chrome : null;

  return (
    <div className="group relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-label="UI preferences"
        className={`${HEADER_CHIP_CLASS} text-ink-muted hover:bg-surface-raised hover:text-ink group-hover:bg-surface-raised group-hover:text-ink group-focus-within:bg-surface-raised group-focus-within:text-ink`}
      >
        <IconUiPrefs size={16} className="size-4 shrink-0" />
      </button>
      <div className="invisible absolute right-0 z-30 pt-1 opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="w-64 rounded-card border border-line bg-surface p-2">
          <p className="px-2 pt-1 pb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">
            Theme
          </p>
          <SchemeRow
            label="Dark and Light"
            hideLabel
            value={both}
            onChange={setBoth}
          />
          <p className="mt-3 px-2 pb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">
            Chrome
          </p>
          <p className="px-2 pb-1.5 text-hint text-ink-faint">
            Sidebar, header, and footer.
          </p>
          <SchemeRow label="Chrome" hideLabel value={chrome} onChange={setChrome} />
          <p className="mt-3 px-2 pb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">
            Content
          </p>
          <p className="px-2 pb-1.5 text-hint text-ink-faint">
            Main page area.
          </p>
          <SchemeRow
            label="Content"
            hideLabel
            value={content}
            onChange={setContent}
          />
        </div>
      </div>
    </div>
  );
}

function SchemeRow({
  label,
  value,
  onChange,
  hideLabel = false,
}: {
  label: string;
  value: UiScheme | null;
  onChange: (scheme: UiScheme) => void;
  hideLabel?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex rounded-control border border-line p-0.5"
    >
      {hideLabel ? null : (
        <span className="sr-only">{label}</span>
      )}
      <SchemeButton
        label="Dark"
        selected={value === "dark"}
        onClick={() => onChange("dark")}
        icon={<IconMoon {...TOGGLE_ICON} />}
      />
      <SchemeButton
        label="Light"
        selected={value === "light"}
        onClick={() => onChange("light")}
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
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-medium ${
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
