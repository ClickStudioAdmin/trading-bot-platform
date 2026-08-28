import { createServiceClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isTemplateDeskType,
  parseTemplateRecipe,
  recipePreview,
  TEMPLATE_RECIPE_VERSION,
  type TemplateDeskType,
  type TemplateRecipe,
  type TemplateVisibility,
} from "./recipe";

export type AutomationTemplate = {
  id: string;
  userId: string | null;
  visibility: TemplateVisibility;
  deskType: TemplateDeskType;
  name: string;
  description: string | null;
  recipe: TemplateRecipe;
  recipeVersion: number;
  createdAtMs: number;
  updatedAtMs: number;
  ownerEmail: string | null;
};

export type AutomationTemplateSet = {
  id: string;
  userId: string | null;
  visibility: TemplateVisibility;
  deskType: TemplateDeskType;
  name: string;
  description: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  ownerEmail: string | null;
  items: AutomationTemplateSetItem[];
};

export type AutomationTemplateSetItem = {
  templateId: string;
  sortOrder: number;
  name: string;
  preview: string;
  visibility: TemplateVisibility;
};

export type TemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  visibility: TemplateVisibility;
  deskType: TemplateDeskType;
  preview: string;
  ownerEmail: string | null;
  updatedAtMs: number;
};

function isUniqueNameError(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export const TEMPLATE_NAME_TAKEN =
  "You already have a template with that name for this desk type.";
export const PLATFORM_NAME_TAKEN =
  "A platform template with that name already exists for this desk type.";
export const SET_NAME_TAKEN =
  "You already have a template set with that name for this desk type.";
export const PLATFORM_SET_NAME_TAKEN =
  "A platform set with that name already exists for this desk type.";

function nameTakenMessage(visibility: TemplateVisibility, kind: "template" | "set") {
  if (kind === "set") {
    return visibility === "platform" ? PLATFORM_SET_NAME_TAKEN : SET_NAME_TAKEN;
  }
  return visibility === "platform" ? PLATFORM_NAME_TAKEN : TEMPLATE_NAME_TAKEN;
}

function parseVisibility(value: unknown): TemplateVisibility {
  return value === "platform" ? "platform" : "user";
}

function asTime(value: unknown): number {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function parseTemplateRow(
  row: Record<string, unknown>,
  ownerEmail: string | null,
): AutomationTemplate | null {
  if (!isTemplateDeskType(row.desk_type)) {
    return null;
  }
  const parsed = parseTemplateRecipe(
    row.recipe,
    row.desk_type,
    Number(row.recipe_version),
  );
  if (!parsed.ok) {
    return null;
  }
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    visibility: parseVisibility(row.visibility),
    deskType: row.desk_type,
    name: String(row.name ?? ""),
    description: row.description ? String(row.description) : null,
    recipe: parsed.recipe,
    recipeVersion: Number(row.recipe_version) || TEMPLATE_RECIPE_VERSION,
    createdAtMs: asTime(row.created_at),
    updatedAtMs: asTime(row.updated_at),
    ownerEmail,
  };
}

async function memberEmails(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (ids.length === 0) {
    return map;
  }
  const { data } = await supabase
    .from("members")
    .select("user_id, email")
    .in("user_id", ids);
  for (const row of data ?? []) {
    const id = String((row as { user_id: string }).user_id);
    const email = String((row as { email?: string }).email ?? "");
    if (id && email) {
      map.set(id, email);
    }
  }
  return map;
}

export function templateToSummary(row: AutomationTemplate): TemplateSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    deskType: row.deskType,
    preview: recipePreview(row.recipe),
    ownerEmail: row.ownerEmail,
    updatedAtMs: row.updatedAtMs,
  };
}

export async function listVisibleTemplates(input: {
  userId: string;
  deskType?: TemplateDeskType | null;
}): Promise<AutomationTemplate[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  let query = supabase
    .from("automation_templates")
    .select("*")
    .or(`visibility.eq.platform,user_id.eq.${input.userId}`)
    .order("visibility", { ascending: true })
    .order("name", { ascending: true });
  if (input.deskType) {
    query = query.eq("desk_type", input.deskType);
  }
  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  const emails = await memberEmails(
    supabase,
    data.map((row) => String((row as { user_id?: string }).user_id ?? "")),
  );
  return data
    .map((row) =>
      parseTemplateRow(
        row as Record<string, unknown>,
        emails.get(String((row as { user_id?: string }).user_id ?? "")) ?? null,
      ),
    )
    .filter((row): row is AutomationTemplate => Boolean(row));
}

export async function listAllTemplates(): Promise<AutomationTemplate[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("automation_templates")
    .select("*")
    .order("visibility", { ascending: true })
    .order("updated_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  const emails = await memberEmails(
    supabase,
    data.map((row) => String((row as { user_id?: string }).user_id ?? "")),
  );
  return data
    .map((row) =>
      parseTemplateRow(
        row as Record<string, unknown>,
        emails.get(String((row as { user_id?: string }).user_id ?? "")) ?? null,
      ),
    )
    .filter((row): row is AutomationTemplate => Boolean(row));
}

export async function loadTemplateById(
  id: string,
): Promise<AutomationTemplate | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("automation_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const emails = await memberEmails(
    supabase,
    data.user_id ? [String(data.user_id)] : [],
  );
  return parseTemplateRow(
    data as Record<string, unknown>,
    emails.get(String(data.user_id ?? "")) ?? null,
  );
}

export async function findNamedTemplate(input: {
  visibility: TemplateVisibility;
  userId: string | null;
  deskType: TemplateDeskType;
  name: string;
}): Promise<AutomationTemplate | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  let query = supabase
    .from("automation_templates")
    .select("*")
    .eq("visibility", input.visibility)
    .eq("desk_type", input.deskType);
  if (input.visibility === "user") {
    query = query.eq("user_id", input.userId);
  } else {
    query = query.is("user_id", null);
  }
  const { data } = await query;
  const needle = input.name.trim().toLowerCase();
  const row = (data ?? []).find(
    (item) => String((item as { name?: string }).name ?? "").trim().toLowerCase() === needle,
  );
  if (!row) {
    return null;
  }
  return parseTemplateRow(row as Record<string, unknown>, null);
}

export async function insertTemplate(input: {
  userId: string | null;
  visibility: TemplateVisibility;
  deskType: TemplateDeskType;
  name: string;
  description: string | null;
  recipe: TemplateRecipe;
}): Promise<
  | { ok: true; template: AutomationTemplate }
  | { ok: false; error: string; code?: "name_taken" }
> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data, error } = await supabase
    .from("automation_templates")
    .insert({
      user_id: input.visibility === "platform" ? null : input.userId,
      visibility: input.visibility,
      desk_type: input.deskType,
      name: input.name,
      description: input.description,
      recipe: input.recipe,
      recipe_version: TEMPLATE_RECIPE_VERSION,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error || !data) {
    if (isUniqueNameError(error)) {
      return {
        ok: false,
        error: nameTakenMessage(input.visibility, "template"),
        code: "name_taken",
      };
    }
    return { ok: false, error: error?.message ?? "Could not save the template." };
  }
  const parsed = parseTemplateRow(data as Record<string, unknown>, null);
  if (!parsed) {
    return { ok: false, error: "Could not save the template." };
  }
  return { ok: true, template: parsed };
}

export async function replaceTemplateRecipe(input: {
  id: string;
  recipe: TemplateRecipe;
  description: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase
    .from("automation_templates")
    .update({
      recipe: input.recipe,
      recipe_version: TEMPLATE_RECIPE_VERSION,
      description: input.description,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function updateTemplateMeta(input: {
  id: string;
  name: string;
  description: string | null;
}): Promise<
  | { ok: true }
  | { ok: false; error: string; code?: "name_taken" }
> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase
    .from("automation_templates")
    .update({
      name: input.name,
      description: input.description,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) {
    if (isUniqueNameError(error)) {
      return { ok: false, error: TEMPLATE_NAME_TAKEN, code: "name_taken" };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase
    .from("automation_templates")
    .delete()
    .eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function loadSetItems(
  supabase: SupabaseClient,
  setIds: string[],
  emails: Map<string, string>,
): Promise<Map<string, AutomationTemplateSetItem[]>> {
  const map = new Map<string, AutomationTemplateSetItem[]>();
  if (setIds.length === 0) {
    return map;
  }
  const { data } = await supabase
    .from("automation_template_set_items")
    .select("set_id, template_id, sort_order")
    .in("set_id", setIds)
    .order("sort_order", { ascending: true });
  const templateIds = [
    ...new Set(
      (data ?? []).map((row) => String((row as { template_id: string }).template_id)),
    ),
  ];
  const templates = new Map<string, AutomationTemplate>();
  if (templateIds.length > 0) {
    const { data: rows } = await supabase
      .from("automation_templates")
      .select("*")
      .in("id", templateIds);
    for (const row of rows ?? []) {
      const parsed = parseTemplateRow(
        row as Record<string, unknown>,
        emails.get(String((row as { user_id?: string }).user_id ?? "")) ?? null,
      );
      if (parsed) {
        templates.set(parsed.id, parsed);
      }
    }
  }
  for (const row of data ?? []) {
    const setId = String((row as { set_id: string }).set_id);
    const templateId = String((row as { template_id: string }).template_id);
    const template = templates.get(templateId);
    const list = map.get(setId) ?? [];
    list.push({
      templateId,
      sortOrder: Number((row as { sort_order: number }).sort_order) || 0,
      name: template?.name ?? "Missing template",
      preview: template ? recipePreview(template.recipe) : "Removed",
      visibility: template?.visibility ?? "user",
    });
    map.set(setId, list);
  }
  return map;
}

function parseSetRow(
  row: Record<string, unknown>,
  items: AutomationTemplateSetItem[],
  ownerEmail: string | null,
): AutomationTemplateSet | null {
  if (!isTemplateDeskType(row.desk_type)) {
    return null;
  }
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    visibility: parseVisibility(row.visibility),
    deskType: row.desk_type,
    name: String(row.name ?? ""),
    description: row.description ? String(row.description) : null,
    createdAtMs: asTime(row.created_at),
    updatedAtMs: asTime(row.updated_at),
    ownerEmail,
    items,
  };
}

export async function listVisibleSets(input: {
  userId: string;
  deskType?: TemplateDeskType | null;
}): Promise<AutomationTemplateSet[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  let query = supabase
    .from("automation_template_sets")
    .select("*")
    .or(`visibility.eq.platform,user_id.eq.${input.userId}`)
    .order("visibility", { ascending: true })
    .order("name", { ascending: true });
  if (input.deskType) {
    query = query.eq("desk_type", input.deskType);
  }
  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  const emails = await memberEmails(
    supabase,
    data.map((row) => String((row as { user_id?: string }).user_id ?? "")),
  );
  const items = await loadSetItems(
    supabase,
    data.map((row) => String((row as { id: string }).id)),
    emails,
  );
  return data
    .map((row) =>
      parseSetRow(
        row as Record<string, unknown>,
        items.get(String((row as { id: string }).id)) ?? [],
        emails.get(String((row as { user_id?: string }).user_id ?? "")) ?? null,
      ),
    )
    .filter((row): row is AutomationTemplateSet => Boolean(row));
}

export async function listAllSets(): Promise<AutomationTemplateSet[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("automation_template_sets")
    .select("*")
    .order("visibility", { ascending: true })
    .order("updated_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  const emails = await memberEmails(
    supabase,
    data.map((row) => String((row as { user_id?: string }).user_id ?? "")),
  );
  const items = await loadSetItems(
    supabase,
    data.map((row) => String((row as { id: string }).id)),
    emails,
  );
  return data
    .map((row) =>
      parseSetRow(
        row as Record<string, unknown>,
        items.get(String((row as { id: string }).id)) ?? [],
        emails.get(String((row as { user_id?: string }).user_id ?? "")) ?? null,
      ),
    )
    .filter((row): row is AutomationTemplateSet => Boolean(row));
}

export async function loadSetById(
  id: string,
): Promise<AutomationTemplateSet | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data } = await supabase
    .from("automation_template_sets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) {
    return null;
  }
  const emails = await memberEmails(
    supabase,
    data.user_id ? [String(data.user_id)] : [],
  );
  const items = await loadSetItems(supabase, [String(data.id)], emails);
  return parseSetRow(
    data as Record<string, unknown>,
    items.get(String(data.id)) ?? [],
    emails.get(String(data.user_id ?? "")) ?? null,
  );
}

export async function insertTemplateSet(input: {
  userId: string | null;
  visibility: TemplateVisibility;
  deskType: TemplateDeskType;
  name: string;
  description: string | null;
  templateIds: string[];
}): Promise<
  | { ok: true; set: AutomationTemplateSet }
  | { ok: false; error: string; code?: "name_taken" }
> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data, error } = await supabase
    .from("automation_template_sets")
    .insert({
      user_id: input.visibility === "platform" ? null : input.userId,
      visibility: input.visibility,
      desk_type: input.deskType,
      name: input.name,
      description: input.description,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error || !data) {
    if (isUniqueNameError(error)) {
      return {
        ok: false,
        error: nameTakenMessage(input.visibility, "set"),
        code: "name_taken",
      };
    }
    return { ok: false, error: error?.message ?? "Could not save the set." };
  }
  const setId = String(data.id);
  if (input.templateIds.length > 0) {
    const { error: itemError } = await supabase
      .from("automation_template_set_items")
      .insert(
        input.templateIds.map((templateId, index) => ({
          set_id: setId,
          template_id: templateId,
          sort_order: index,
        })),
      );
    if (itemError) {
      await supabase.from("automation_template_sets").delete().eq("id", setId);
      return { ok: false, error: itemError.message };
    }
  }
  const loaded = await loadSetById(setId);
  if (!loaded) {
    return { ok: false, error: "Could not save the set." };
  }
  return { ok: true, set: loaded };
}

export async function replaceSetItems(input: {
  setId: string;
  templateIds: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error: delError } = await supabase
    .from("automation_template_set_items")
    .delete()
    .eq("set_id", input.setId);
  if (delError) {
    return { ok: false, error: delError.message };
  }
  if (input.templateIds.length === 0) {
    return { ok: true };
  }
  const { error } = await supabase.from("automation_template_set_items").insert(
    input.templateIds.map((templateId, index) => ({
      set_id: input.setId,
      template_id: templateId,
      sort_order: index,
    })),
  );
  if (error) {
    return { ok: false, error: error.message };
  }
  await supabase
    .from("automation_template_sets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.setId);
  return { ok: true };
}

export async function updateSetMeta(input: {
  id: string;
  name: string;
  description: string | null;
}): Promise<
  | { ok: true }
  | { ok: false; error: string; code?: "name_taken" }
> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase
    .from("automation_template_sets")
    .update({
      name: input.name,
      description: input.description,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) {
    if (isUniqueNameError(error)) {
      return { ok: false, error: SET_NAME_TAKEN, code: "name_taken" };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteTemplateSet(id: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase
    .from("automation_template_sets")
    .delete()
    .eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
