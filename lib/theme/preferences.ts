export type UiScheme = "dark" | "light";
export type UiThemeRegion = "chrome" | "content";

export const UI_CHROME_COOKIE = "tbp.ui.chrome";
export const UI_CONTENT_COOKIE = "tbp.ui.content";
export const UI_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseUiScheme(value: string | undefined | null): UiScheme {
  return value === "light" ? "light" : "dark";
}

export function uiSchemeClass(scheme: UiScheme) {
  return scheme === "light" ? "theme-light theme-preview-canvas" : "";
}

export function writeUiSchemeCookie(name: string, scheme: UiScheme) {
  document.cookie = `${name}=${scheme}; path=/; max-age=${UI_COOKIE_MAX_AGE}; samesite=lax`;
}
