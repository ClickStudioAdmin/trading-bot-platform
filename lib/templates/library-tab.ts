export const LIBRARY_TABS = [
  "templates",
  "sets",
  "shared-templates",
  "shared-sets",
] as const;

export type LibraryTab = (typeof LIBRARY_TABS)[number];

export function parseLibraryTab(
  raw: string | string[] | undefined,
): LibraryTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "sets" || value === "shared-templates" || value === "shared-sets") {
    return value;
  }
  return "templates";
}

/** Bot Templates, with this template selected. Shared rows use the Shared Templates tab. Platform rows an admin can open use Admin → Templates. */
export function templatePageHref(
  templateId: string,
  place: "account" | "shared" | "admin" = "account",
): string {
  const params = new URLSearchParams();
  if (place === "shared") {
    params.set("tab", "shared-templates");
  }
  params.set("template", templateId.trim());
  const path = place === "admin" ? "/admin/templates" : "/account/templates";
  return `${path}?${params.toString()}`;
}
