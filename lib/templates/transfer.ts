import {
  isTemplateDeskType,
  parseTemplateName,
  parseTemplateRecipe,
  TEMPLATE_NAME_MAX,
  TEMPLATE_RECIPE_VERSION,
  type TemplateDeskType,
  type TemplateRecipe,
} from "./recipe";

export const TEMPLATE_LIBRARY_FORMAT = "tbp.automation-templates";
export const TEMPLATE_LIBRARY_VERSION = 1;

export type TemplateLibraryFile = {
  format: typeof TEMPLATE_LIBRARY_FORMAT;
  version: number;
  exportedAt: string;
  templates: TemplateLibraryTemplate[];
  sets: TemplateLibrarySet[];
};

export type TemplateLibraryTemplate = {
  id: string;
  name: string;
  description: string | null;
  deskType: TemplateDeskType;
  recipe: TemplateRecipe;
  recipeVersion: number;
};

export type TemplateLibrarySet = {
  id: string;
  name: string;
  description: string | null;
  deskType: TemplateDeskType;
  items: string[];
};

export type PlannedImportTemplate = {
  sourceId: string;
  name: string;
  description: string | null;
  deskType: TemplateDeskType;
  recipe: TemplateRecipe;
};

export type PlannedImportSet = {
  name: string;
  description: string | null;
  deskType: TemplateDeskType;
  sourceItemIds: string[];
};

export type LibraryImportPlan = {
  templates: PlannedImportTemplate[];
  sets: PlannedImportSet[];
  notes: string[];
};

export function uniqueLibraryName(
  base: string,
  existing: string[],
  max = TEMPLATE_NAME_MAX,
): string {
  const taken = new Set(existing.map((name) => name.trim().toLowerCase()));
  const trimmed = base.trim() || "Template";
  if (!taken.has(trimmed.toLowerCase()) && trimmed.length <= max) {
    return trimmed;
  }
  const suffixFor = (n: number) =>
    n === 1 ? " (import)" : ` (import ${n})`;
  let n = 1;
  while (n < 100) {
    const suffix = suffixFor(n);
    const name = `${trimmed.slice(0, Math.max(1, max - suffix.length))}${suffix}`;
    if (!taken.has(name.toLowerCase())) {
      return name.slice(0, max);
    }
    n += 1;
  }
  return trimmed.slice(0, max);
}

export function buildTemplateLibraryFile(input: {
  templates: Array<{
    id: string;
    name: string;
    description: string | null;
    deskType: TemplateDeskType;
    recipe: TemplateRecipe;
    recipeVersion: number;
  }>;
  sets: Array<{
    id: string;
    name: string;
    description: string | null;
    deskType: TemplateDeskType;
    items: Array<{ templateId: string }>;
  }>;
  now?: Date;
}): TemplateLibraryFile {
  const templates = input.templates.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    deskType: row.deskType,
    recipe: row.recipe,
    recipeVersion: row.recipeVersion,
  }));
  const known = new Set(templates.map((row) => row.id));
  const sets = input.sets.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    deskType: row.deskType,
    items: row.items
      .map((item) => item.templateId)
      .filter((id) => known.has(id)),
  }));
  return {
    format: TEMPLATE_LIBRARY_FORMAT,
    version: TEMPLATE_LIBRARY_VERSION,
    exportedAt: (input.now ?? new Date()).toISOString(),
    templates,
    sets,
  };
}

export function parseTemplateLibraryJson(
  raw: string,
):
  | { ok: true; file: TemplateLibraryFile }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  return parseTemplateLibraryFile(parsed);
}

export function parseTemplateLibraryFile(
  raw: unknown,
):
  | { ok: true; file: TemplateLibraryFile }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "That file is not a template library." };
  }
  const row = raw as Record<string, unknown>;
  if (row.format !== TEMPLATE_LIBRARY_FORMAT) {
    return { ok: false, error: "That file is not a template library." };
  }
  if (row.version !== TEMPLATE_LIBRARY_VERSION) {
    return {
      ok: false,
      error: "This library file is from a newer app version.",
    };
  }
  if (!Array.isArray(row.templates) || !Array.isArray(row.sets)) {
    return { ok: false, error: "That file is missing templates or sets." };
  }
  const templates: TemplateLibraryTemplate[] = [];
  for (const item of row.templates) {
    const parsed = parseLibraryTemplate(item);
    if (!parsed.ok) {
      continue;
    }
    templates.push(parsed.template);
  }
  const known = new Set(templates.map((item) => item.id));
  const sets: TemplateLibrarySet[] = [];
  for (const item of row.sets) {
    const parsed = parseLibrarySet(item, known);
    if (!parsed.ok) {
      continue;
    }
    sets.push(parsed.set);
  }
  if (templates.length === 0 && sets.length === 0) {
    return { ok: false, error: "That file has no templates or sets to import." };
  }
  return {
    ok: true,
    file: {
      format: TEMPLATE_LIBRARY_FORMAT,
      version: TEMPLATE_LIBRARY_VERSION,
      exportedAt:
        typeof row.exportedAt === "string" ? row.exportedAt : new Date().toISOString(),
      templates,
      sets,
    },
  };
}

export function planLibraryImport(
  file: TemplateLibraryFile,
  existing: {
    templates: { deskType: TemplateDeskType; name: string }[];
    sets: { deskType: TemplateDeskType; name: string }[];
  },
): LibraryImportPlan {
  const notes: string[] = [];
  const takenTemplates = new Map<TemplateDeskType, string[]>();
  const takenSets = new Map<TemplateDeskType, string[]>();
  for (const row of existing.templates) {
    const list = takenTemplates.get(row.deskType) ?? [];
    list.push(row.name);
    takenTemplates.set(row.deskType, list);
  }
  for (const row of existing.sets) {
    const list = takenSets.get(row.deskType) ?? [];
    list.push(row.name);
    takenSets.set(row.deskType, list);
  }

  const templates: PlannedImportTemplate[] = [];
  for (const row of file.templates) {
    const taken = takenTemplates.get(row.deskType) ?? [];
    const name = uniqueLibraryName(row.name, taken);
    if (name !== row.name) {
      notes.push(`Renamed template “${row.name}” to “${name}”.`);
    }
    taken.push(name);
    takenTemplates.set(row.deskType, taken);
    templates.push({
      sourceId: row.id,
      name,
      description: row.description,
      deskType: row.deskType,
      recipe: row.recipe,
    });
  }

  const sets: PlannedImportSet[] = [];
  const importedIds = new Set(templates.map((row) => row.sourceId));
  for (const row of file.sets) {
    const sourceItemIds = row.items.filter((id) => importedIds.has(id));
    if (sourceItemIds.length === 0) {
      notes.push(`Skipped set “${row.name}”: none of its templates imported.`);
      continue;
    }
    if (sourceItemIds.length < row.items.length) {
      notes.push(
        `Set “${row.name}” dropped ${row.items.length - sourceItemIds.length} missing template(s).`,
      );
    }
    const taken = takenSets.get(row.deskType) ?? [];
    const name = uniqueLibraryName(row.name, taken);
    if (name !== row.name) {
      notes.push(`Renamed set “${row.name}” to “${name}”.`);
    }
    taken.push(name);
    takenSets.set(row.deskType, taken);
    sets.push({
      name,
      description: row.description,
      deskType: row.deskType,
      sourceItemIds,
    });
  }

  return { templates, sets, notes };
}

function parseLibraryTemplate(
  raw: unknown,
):
  | { ok: true; template: TemplateLibraryTemplate }
  | { ok: false } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false };
  }
  const row = raw as Record<string, unknown>;
  if (!isTemplateDeskType(row.deskType)) {
    return { ok: false };
  }
  const name = parseTemplateName(row.name);
  if (!name.ok) {
    return { ok: false };
  }
  const version = Number(row.recipeVersion ?? TEMPLATE_RECIPE_VERSION);
  const parsed = parseTemplateRecipe(row.recipe, row.deskType, version);
  if (!parsed.ok) {
    return { ok: false };
  }
  const id = String(row.id ?? "").trim();
  if (!id) {
    return { ok: false };
  }
  return {
    ok: true,
    template: {
      id,
      name: name.name,
      description:
        typeof row.description === "string" && row.description.trim()
          ? row.description.trim().slice(0, 500)
          : null,
      deskType: row.deskType,
      recipe: parsed.recipe,
      recipeVersion: TEMPLATE_RECIPE_VERSION,
    },
  };
}

function parseLibrarySet(
  raw: unknown,
  knownTemplateIds: Set<string>,
):
  | { ok: true; set: TemplateLibrarySet }
  | { ok: false } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false };
  }
  const row = raw as Record<string, unknown>;
  if (!isTemplateDeskType(row.deskType)) {
    return { ok: false };
  }
  const name = parseTemplateName(row.name);
  if (!name.ok) {
    return { ok: false };
  }
  const id = String(row.id ?? "").trim();
  if (!id) {
    return { ok: false };
  }
  const items = Array.isArray(row.items)
    ? row.items
        .map((item) => String(item ?? "").trim())
        .filter((item) => knownTemplateIds.has(item))
    : [];
  return {
    ok: true,
    set: {
      id,
      name: name.name,
      description:
        typeof row.description === "string" && row.description.trim()
          ? row.description.trim().slice(0, 500)
          : null,
      deskType: row.deskType,
      items,
    },
  };
}

export function parseShareEmail(
  raw: unknown,
): { ok: true; email: string } | { ok: false; error: string } {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    return { ok: false, error: "Enter a valid email." };
  }
  return { ok: true, email };
}
