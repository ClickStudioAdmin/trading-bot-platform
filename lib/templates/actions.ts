"use server";

import { memberIsAdmin } from "@/lib/admin/access";
import { getSessionContext, getSessionMember } from "@/lib/auth/session";
import { deskPath } from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import { parsePaperRulesForm } from "@/lib/engine/rules";
import { parseFuturesAutomationForm } from "@/lib/futures/automation";
import { writeEventLog } from "@/lib/logs/write";
import { revalidatePath } from "next/cache";
import {
  applyTemplateSetToDesk,
  applyTemplateToDesk,
  automationsPathForDeskType,
  type ApplyItemInput,
  type ApplyItemResult,
} from "./apply";
import {
  parseTemplateDescription,
  parseTemplateName,
  snapshotDcaRecipe,
  snapshotPaperRecipe,
  snapshotPerpsRecipe,
  type TemplateDeskType,
  type TemplateRecipe,
  type TemplateVisibility,
} from "./recipe";
import {
  deleteSetShare,
  deleteTemplate,
  deleteTemplateSet,
  deleteTemplateShare,
  findMemberByEmail,
  findNamedTemplate,
  insertSetShare,
  insertTemplate,
  insertTemplateSet,
  insertTemplateShare,
  listAllSets,
  listAllTemplates,
  listVisibleSets,
  listVisibleTemplates,
  loadSetById,
  loadTemplateById,
  replaceSetItems,
  replaceTemplateRecipe,
  setIsSharedWith,
  templateIsSharedWith,
  updateSetMeta,
  updateTemplateMeta,
  type AutomationTemplate,
} from "./store";
import {
  buildTemplateLibraryFile,
  parseShareEmail,
  parseTemplateLibraryJson,
  planLibraryImport,
} from "./transfer";

export type TemplateActionResult = {
  ok: boolean;
  error?: string;
  code?: "name_taken" | "symbol_taken" | "desk_type" | "forbidden" | "already_shared";
  symbol?: string;
  notes?: string[];
  results?: ApplyItemResult[];
  json?: string;
  filename?: string;
};

function revalidateTemplateSurfaces(accountId?: string, deskType?: TemplateDeskType) {
  revalidatePath("/account/templates");
  revalidatePath("/admin/templates");
  if (accountId && deskType) {
    revalidatePath(deskPath(automationsPathForDeskType(deskType), accountId));
  } else {
    revalidatePath("/strategies/futures/automations");
    revalidatePath("/strategies/cash-and-carry/automations");
  }
}

async function requireMember() {
  const member = await getSessionMember();
  if (!member) {
    return { ok: false as const, error: "Sign in to continue." };
  }
  return {
    ok: true as const,
    member,
    isAdmin: memberIsAdmin(member),
  };
}

function parseVisibility(
  raw: unknown,
  isAdmin: boolean,
): { ok: true; visibility: TemplateVisibility } | { ok: false; error: string } {
  if (raw === "platform") {
    if (!isAdmin) {
      return { ok: false, error: "Only admins can save platform templates." };
    }
    return { ok: true, visibility: "platform" };
  }
  return { ok: true, visibility: "user" };
}

function canManageRow(
  visibility: TemplateVisibility,
  ownerId: string | null,
  userId: string,
  isAdmin: boolean,
): boolean {
  if (visibility === "platform") {
    return isAdmin;
  }
  return ownerId === userId || isAdmin;
}

function canManageTemplate(
  template: AutomationTemplate,
  userId: string,
  isAdmin: boolean,
): boolean {
  return canManageRow(template.visibility, template.userId, userId, isAdmin);
}

function canReadTemplate(template: AutomationTemplate, userId: string, isAdmin: boolean) {
  return (
    template.visibility === "platform" ||
    template.userId === userId ||
    isAdmin
  );
}

function canShareRow(
  visibility: TemplateVisibility,
  ownerId: string | null,
  userId: string,
  isAdmin: boolean,
): boolean {
  return visibility === "user" && (ownerId === userId || isAdmin);
}

async function saveNamedRecipe(input: {
  userId: string;
  isAdmin: boolean;
  visibility: TemplateVisibility;
  deskType: TemplateDeskType;
  name: string;
  description: string | null;
  replace: boolean;
  recipe: TemplateRecipe;
}): Promise<TemplateActionResult> {
  if (input.replace) {
    const existing = await findNamedTemplate({
      visibility: input.visibility,
      userId: input.visibility === "user" ? input.userId : null,
      deskType: input.deskType,
      name: input.name,
    });
    if (existing) {
      if (!canManageTemplate(existing, input.userId, input.isAdmin)) {
        return { ok: false, error: "You cannot replace that template.", code: "forbidden" };
      }
      const replaced = await replaceTemplateRecipe({
        id: existing.id,
        recipe: input.recipe,
        description: input.description,
      });
      if (!replaced.ok) {
        return replaced;
      }
      await writeEventLog({
        scope: "strategy",
        event: "template.saved",
        message: `Replaced template ${input.name}`,
        userId: input.userId,
        data: { template_id: existing.id, desk_type: input.deskType },
      });
      revalidateTemplateSurfaces();
      return { ok: true };
    }
  }
  const inserted = await insertTemplate({
    userId: input.visibility === "platform" ? null : input.userId,
    visibility: input.visibility,
    deskType: input.deskType,
    name: input.name,
    description: input.description,
    recipe: input.recipe,
  });
  if (!inserted.ok) {
    return inserted;
  }
  await writeEventLog({
    scope: "strategy",
    event: "template.saved",
    message: `Saved template ${input.name}`,
    userId: input.userId,
    data: {
      template_id: inserted.template.id,
      desk_type: input.deskType,
      visibility: input.visibility,
    },
  });
  revalidateTemplateSurfaces();
  return { ok: true };
}

function metaFromForm(formData: FormData, isAdmin: boolean) {
  const name = parseTemplateName(formData.get("templateName"));
  const visibility = parseVisibility(formData.get("visibility"), isAdmin);
  if (!name.ok) {
    return name;
  }
  if (!visibility.ok) {
    return visibility;
  }
  return {
    ok: true as const,
    name: name.name,
    description: parseTemplateDescription(formData.get("templateDescription")),
    visibility: visibility.visibility,
    replace: formData.get("replaceExisting") === "1",
  };
}

export async function saveDcaAsTemplateAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const meta = metaFromForm(formData, auth.isAdmin);
  if (!meta.ok) {
    return meta;
  }
  const parsed = parseDcaPlaybookForm(formData);
  if (!parsed.ok) {
    return parsed;
  }
  return saveNamedRecipe({
    userId: auth.member.id,
    isAdmin: auth.isAdmin,
    visibility: meta.visibility,
    deskType: "dca",
    name: meta.name,
    description: meta.description,
    replace: meta.replace,
    recipe: snapshotDcaRecipe(parsed.config),
  });
}

export async function savePerpsAsTemplateAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const meta = metaFromForm(formData, auth.isAdmin);
  if (!meta.ok) {
    return meta;
  }
  const parsed = parseFuturesAutomationForm(formData);
  if (!parsed.ok) {
    return parsed;
  }
  const rule = parsed.rules[0];
  if (!rule) {
    return { ok: false, error: "That rule is incomplete." };
  }
  return saveNamedRecipe({
    userId: auth.member.id,
    isAdmin: auth.isAdmin,
    visibility: meta.visibility,
    deskType: "perps",
    name: meta.name,
    description: meta.description,
    replace: meta.replace,
    recipe: snapshotPerpsRecipe(rule),
  });
}

export async function savePaperAsTemplateAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const meta = metaFromForm(formData, auth.isAdmin);
  if (!meta.ok) {
    return meta;
  }
  const parsed = parsePaperRulesForm(formData);
  if (!parsed.ok) {
    return parsed;
  }
  const layer = parsed.config.layers[0];
  if (!layer) {
    return { ok: false, error: "That set is incomplete." };
  }
  return saveNamedRecipe({
    userId: auth.member.id,
    isAdmin: auth.isAdmin,
    visibility: meta.visibility,
    deskType: "cash_and_carry",
    name: meta.name,
    description: meta.description,
    replace: meta.replace,
    recipe: snapshotPaperRecipe(layer),
  });
}

export async function updateTemplateMetaAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const id = String(formData.get("templateId") ?? "").trim();
  const template = await loadTemplateById(id);
  if (!template || !canManageTemplate(template, auth.member.id, auth.isAdmin)) {
    return { ok: false, error: "That template was not found.", code: "forbidden" };
  }
  const name = parseTemplateName(formData.get("templateName") ?? formData.get("name"));
  if (!name.ok) {
    return name;
  }
  const updated = await updateTemplateMeta({
    id,
    name: name.name,
    description: parseTemplateDescription(
      formData.get("templateDescription") ?? formData.get("description"),
    ),
  });
  if (!updated.ok) {
    return updated;
  }
  revalidateTemplateSurfaces();
  return { ok: true };
}

export async function deleteTemplateAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const id = String(formData.get("templateId") ?? "").trim();
  const template = await loadTemplateById(id);
  if (!template || !canManageTemplate(template, auth.member.id, auth.isAdmin)) {
    return { ok: false, error: "That template was not found.", code: "forbidden" };
  }
  const deleted = await deleteTemplate(id);
  if (!deleted.ok) {
    return deleted;
  }
  await writeEventLog({
    scope: "strategy",
    event: "template.deleted",
    message: `Deleted template ${template.name}`,
    userId: auth.member.id,
    data: { template_id: id, desk_type: template.deskType },
  });
  revalidateTemplateSurfaces();
  return { ok: true };
}

export async function publishTemplateCopyAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  if (!auth.isAdmin) {
    return { ok: false, error: "Only admins can publish platform templates." };
  }
  const id = String(formData.get("templateId") ?? "").trim();
  const template = await loadTemplateById(id);
  if (!template || !canReadTemplate(template, auth.member.id, true)) {
    return { ok: false, error: "That template was not found.", code: "forbidden" };
  }
  const name = parseTemplateName(
    formData.get("templateName") ?? template.name,
  );
  if (!name.ok) {
    return name;
  }
  const inserted = await insertTemplate({
    userId: null,
    visibility: "platform",
    deskType: template.deskType,
    name: name.name,
    description: parseTemplateDescription(
      formData.get("templateDescription") ?? template.description,
    ),
    recipe: template.recipe,
  });
  if (!inserted.ok) {
    return inserted;
  }
  await writeEventLog({
    scope: "strategy",
    event: "template.saved",
    message: `Published platform template ${name.name}`,
    userId: auth.member.id,
    data: {
      template_id: inserted.template.id,
      source_id: template.id,
      desk_type: template.deskType,
    },
  });
  revalidateTemplateSurfaces();
  return { ok: true };
}

export async function applyTemplateAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const session = await getSessionContext();
  if (!session) {
    return { ok: false, error: "Sign in to continue." };
  }
  const templateId = String(formData.get("templateId") ?? "").trim();
  const accountId =
    String(formData.get("accountId") ?? "").trim() || session.account.id;
  const result = await applyTemplateToDesk({
    userId: session.member.id,
    accountId,
    templateId,
    symbol: String(formData.get("symbol") ?? "").trim() || undefined,
    webhookId: String(formData.get("webhookId") ?? "").trim() || null,
    skip: formData.get("skip") === "1",
  });
  if (result.ok && !result.skipped) {
    const desks = await listTradingAccounts(session.member.id);
    const desk = desks.find((row) => row.id === accountId);
    await writeEventLog({
      scope: "strategy",
      event: "template.applied",
      message: `Applied template ${result.name}`,
      userId: session.member.id,
      accountId,
      data: { template_id: templateId },
    });
    if (desk && desk.deskType !== "signal_follower") {
      revalidateTemplateSurfaces(
        accountId,
        desk.deskType === "cash_and_carry" ||
          desk.deskType === "perps" ||
          desk.deskType === "dca"
          ? desk.deskType
          : undefined,
      );
    }
  }
  return {
    ok: result.ok,
    error: result.error,
    code: result.code,
    symbol: result.symbol,
    notes: result.notes,
    results: [result],
  };
}

export async function applyTemplateSetAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const session = await getSessionContext();
  if (!session) {
    return { ok: false, error: "Sign in to continue." };
  }
  const setId = String(formData.get("setId") ?? "").trim();
  const accountId =
    String(formData.get("accountId") ?? "").trim() || session.account.id;
  const count = Number(String(formData.get("itemCount") ?? "0"));
  const items: ApplyItemInput[] = [];
  for (let i = 0; i < count; i += 1) {
    items.push({
      templateId: String(formData.get(`i${i}_templateId`) ?? "").trim(),
      skip: formData.get(`i${i}_skip`) === "1",
      symbol: String(formData.get(`i${i}_symbol`) ?? "").trim() || undefined,
      webhookId: String(formData.get(`i${i}_webhookId`) ?? "").trim() || null,
    });
  }
  const applied = await applyTemplateSetToDesk({
    userId: session.member.id,
    accountId,
    setId,
    items,
  });
  if (!applied.ok) {
    return { ok: false, error: applied.error };
  }
  await writeEventLog({
    scope: "strategy",
    event: "template.applied",
    message: `Applied template set`,
    userId: session.member.id,
    accountId,
    data: { set_id: setId },
  });
  if (applied.deskType) {
    revalidateTemplateSurfaces(accountId, applied.deskType);
  }
  return { ok: true, results: applied.results };
}

export async function createTemplateSetAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const meta = metaFromForm(formData, auth.isAdmin);
  if (!meta.ok) {
    return meta;
  }
  const deskTypeRaw = String(formData.get("deskType") ?? "");
  if (
    deskTypeRaw !== "dca" &&
    deskTypeRaw !== "perps" &&
    deskTypeRaw !== "cash_and_carry"
  ) {
    return { ok: false, error: "Choose a desk type." };
  }
  const ids = String(formData.get("templateIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    return { ok: false, error: "Pick at least one template." };
  }
  for (const id of ids) {
    const template = await loadTemplateById(id);
    if (!template || !canReadTemplate(template, auth.member.id, auth.isAdmin)) {
      return { ok: false, error: "One of those templates was not found." };
    }
    if (template.deskType !== deskTypeRaw) {
      return { ok: false, error: "Every template in a set must share a desk type." };
    }
    if (meta.visibility === "platform" && template.visibility !== "platform") {
      return { ok: false, error: "Platform sets may only contain platform templates." };
    }
    if (
      meta.visibility === "user" &&
      template.visibility === "user" &&
      template.userId !== auth.member.id
    ) {
      return { ok: false, error: "You can only add your templates or platform templates." };
    }
  }
  const inserted = await insertTemplateSet({
    userId: meta.visibility === "platform" ? null : auth.member.id,
    visibility: meta.visibility,
    deskType: deskTypeRaw,
    name: meta.name,
    description: meta.description,
    templateIds: ids,
  });
  if (!inserted.ok) {
    return inserted;
  }
  revalidateTemplateSurfaces();
  return { ok: true };
}

export async function updateTemplateSetAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const id = String(formData.get("setId") ?? "").trim();
  const set = await loadSetById(id);
  if (
    !set ||
    !canManageRow(set.visibility, set.userId, auth.member.id, auth.isAdmin)
  ) {
    return { ok: false, error: "That set was not found.", code: "forbidden" };
  }
  const name = parseTemplateName(formData.get("templateName") ?? formData.get("name"));
  if (!name.ok) {
    return name;
  }
  const updated = await updateSetMeta({
    id,
    name: name.name,
    description: parseTemplateDescription(
      formData.get("templateDescription") ?? formData.get("description"),
    ),
  });
  if (!updated.ok) {
    return updated;
  }
  const idsRaw = formData.get("templateIds");
  if (idsRaw != null && String(idsRaw).length >= 0) {
    const ids = String(idsRaw)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const replaced = await replaceSetItems({ setId: id, templateIds: ids });
    if (!replaced.ok) {
      return replaced;
    }
  }
  revalidateTemplateSurfaces();
  return { ok: true };
}

export async function deleteTemplateSetAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const id = String(formData.get("setId") ?? "").trim();
  const set = await loadSetById(id);
  if (
    !set ||
    !canManageRow(set.visibility, set.userId, auth.member.id, auth.isAdmin)
  ) {
    return { ok: false, error: "That set was not found.", code: "forbidden" };
  }
  const deleted = await deleteTemplateSet(id);
  if (!deleted.ok) {
    return deleted;
  }
  revalidateTemplateSurfaces();
  return { ok: true };
}

export async function shareTemplateAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const id = String(formData.get("templateId") ?? "").trim();
  const template = await loadTemplateById(id);
  if (
    !template ||
    !canShareRow(template.visibility, template.userId, auth.member.id, auth.isAdmin)
  ) {
    return { ok: false, error: "That template was not found.", code: "forbidden" };
  }
  const email = parseShareEmail(formData.get("email"));
  if (!email.ok) {
    return email;
  }
  const member = await findMemberByEmail(email.email);
  if (!member) {
    return { ok: false, error: "No member with that email." };
  }
  if (member.status === "disabled") {
    return { ok: false, error: "That member is disabled." };
  }
  if (member.userId === auth.member.id) {
    return { ok: false, error: "You cannot share with yourself." };
  }
  const shared = await insertTemplateShare({
    templateId: template.id,
    fromUserId: auth.member.id,
    toUserId: member.userId,
  });
  if (!shared.ok) {
    return shared;
  }
  await writeEventLog({
    scope: "strategy",
    event: "template.shared",
    message: `Shared template ${template.name} with ${member.email}`,
    userId: auth.member.id,
    data: { template_id: template.id, to_user_id: member.userId },
  });
  revalidateTemplateSurfaces();
  return { ok: true };
}

export async function shareSetAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const id = String(formData.get("setId") ?? "").trim();
  const set = await loadSetById(id);
  if (
    !set ||
    !canShareRow(set.visibility, set.userId, auth.member.id, auth.isAdmin)
  ) {
    return { ok: false, error: "That set was not found.", code: "forbidden" };
  }
  const email = parseShareEmail(formData.get("email"));
  if (!email.ok) {
    return email;
  }
  const member = await findMemberByEmail(email.email);
  if (!member) {
    return { ok: false, error: "No member with that email." };
  }
  if (member.status === "disabled") {
    return { ok: false, error: "That member is disabled." };
  }
  if (member.userId === auth.member.id) {
    return { ok: false, error: "You cannot share with yourself." };
  }
  const shared = await insertSetShare({
    setId: set.id,
    fromUserId: auth.member.id,
    toUserId: member.userId,
  });
  if (!shared.ok) {
    return shared;
  }
  await writeEventLog({
    scope: "strategy",
    event: "template.shared",
    message: `Shared set ${set.name} with ${member.email}`,
    userId: auth.member.id,
    data: { set_id: set.id, to_user_id: member.userId },
  });
  revalidateTemplateSurfaces();
  return { ok: true };
}

export async function unshareTemplateAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const id = String(formData.get("templateId") ?? "").trim();
  const toUserId = String(formData.get("toUserId") ?? "").trim() || auth.member.id;
  const template = await loadTemplateById(id);
  if (!template) {
    return { ok: false, error: "That template was not found.", code: "forbidden" };
  }
  const isRecipient = toUserId === auth.member.id;
  const canRevoke =
    canShareRow(template.visibility, template.userId, auth.member.id, auth.isAdmin) ||
    (isRecipient && (await templateIsSharedWith(auth.member.id, id)));
  if (!canRevoke) {
    return { ok: false, error: "That share was not found.", code: "forbidden" };
  }
  const deleted = await deleteTemplateShare({ templateId: id, toUserId });
  if (!deleted.ok) {
    return deleted;
  }
  revalidateTemplateSurfaces();
  return { ok: true };
}

export async function unshareSetAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const id = String(formData.get("setId") ?? "").trim();
  const toUserId = String(formData.get("toUserId") ?? "").trim() || auth.member.id;
  const set = await loadSetById(id);
  if (!set) {
    return { ok: false, error: "That set was not found.", code: "forbidden" };
  }
  const isRecipient = toUserId === auth.member.id;
  const canRevoke =
    canShareRow(set.visibility, set.userId, auth.member.id, auth.isAdmin) ||
    (isRecipient && (await setIsSharedWith(auth.member.id, id)));
  if (!canRevoke) {
    return { ok: false, error: "That share was not found.", code: "forbidden" };
  }
  const deleted = await deleteSetShare({ setId: id, toUserId });
  if (!deleted.ok) {
    return deleted;
  }
  revalidateTemplateSurfaces();
  return { ok: true };
}

export async function exportTemplateLibraryAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const scope = String(formData.get("scope") ?? "own");
  if (scope === "all" && !auth.isAdmin) {
    return { ok: false, error: "Only admins can export every library.", code: "forbidden" };
  }
  const templates =
    scope === "all"
      ? await listAllTemplates()
      : (await listVisibleTemplates({ userId: auth.member.id })).filter(
          (row) => row.visibility === "user" && row.userId === auth.member.id,
        );
  const sets =
    scope === "all"
      ? await listAllSets()
      : (await listVisibleSets({ userId: auth.member.id })).filter(
          (row) => row.visibility === "user" && row.userId === auth.member.id,
        );
  const file = buildTemplateLibraryFile({ templates, sets });
  const day = file.exportedAt.slice(0, 10);
  return {
    ok: true,
    json: `${JSON.stringify(file, null, 2)}\n`,
    filename: `tbp-templates-${day}.json`,
  };
}

export async function importTemplateLibraryAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const parsed = parseTemplateLibraryJson(String(formData.get("libraryJson") ?? ""));
  if (!parsed.ok) {
    return parsed;
  }
  const existingTemplates = (
    await listVisibleTemplates({ userId: auth.member.id })
  ).filter((row) => row.visibility === "user" && row.userId === auth.member.id);
  const existingSets = (
    await listVisibleSets({ userId: auth.member.id })
  ).filter((row) => row.visibility === "user" && row.userId === auth.member.id);
  const plan = planLibraryImport(parsed.file, {
    templates: existingTemplates.map((row) => ({
      deskType: row.deskType,
      name: row.name,
    })),
    sets: existingSets.map((row) => ({
      deskType: row.deskType,
      name: row.name,
    })),
  });
  if (plan.templates.length === 0 && plan.sets.length === 0) {
    return { ok: false, error: "Nothing to import." };
  }
  const idMap = new Map<string, string>();
  const notes = [...plan.notes];
  for (const row of plan.templates) {
    const inserted = await insertTemplate({
      userId: auth.member.id,
      visibility: "user",
      deskType: row.deskType,
      name: row.name,
      description: row.description,
      recipe: row.recipe,
    });
    if (!inserted.ok) {
      notes.push(`Skipped template “${row.name}”: ${inserted.error}`);
      continue;
    }
    idMap.set(row.sourceId, inserted.template.id);
  }
  for (const row of plan.sets) {
    const templateIds = row.sourceItemIds
      .map((id) => idMap.get(id))
      .filter((id): id is string => Boolean(id));
    if (templateIds.length === 0) {
      notes.push(`Skipped set “${row.name}”: none of its templates imported.`);
      continue;
    }
    const inserted = await insertTemplateSet({
      userId: auth.member.id,
      visibility: "user",
      deskType: row.deskType,
      name: row.name,
      description: row.description,
      templateIds,
    });
    if (!inserted.ok) {
      notes.push(`Skipped set “${row.name}”: ${inserted.error}`);
    }
  }
  const importedTemplates = idMap.size;
  const importedSets = plan.sets.filter((row) =>
    row.sourceItemIds.some((id) => idMap.has(id)),
  ).length;
  await writeEventLog({
    scope: "strategy",
    event: "template.imported",
    message: `Imported ${importedTemplates} templates and ${importedSets} sets`,
    userId: auth.member.id,
    data: {
      templates: importedTemplates,
      sets: importedSets,
    },
  });
  revalidateTemplateSurfaces();
  notes.unshift(
    `Imported ${importedTemplates} template${importedTemplates === 1 ? "" : "s"} and ${importedSets} set${importedSets === 1 ? "" : "s"}.`,
  );
  return { ok: true, notes };
}
