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
