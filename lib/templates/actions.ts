"use server";

import { memberIsAdmin } from "@/lib/admin/access";
import { getSessionContext, getSessionMember } from "@/lib/auth/session";
import { deskPath } from "@/lib/accounts/model";
import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import { parsePaperRulesForm } from "@/lib/engine/rules";
import { parseFuturesAutomationForm } from "@/lib/futures/automation";
import { writeEventLog } from "@/lib/logs/write";
import { revalidatePath } from "next/cache";
import {
  applyTemplateSetToDesk,
  applyTemplateToDesk,
  automationsPathForDeskType,
  type AppliedDeskItem,
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
  hasDirectTemplateShare,
  findMemberByEmail,
  findNamedTemplate,
  appendTemplateToSet,
  insertSetShare,
  insertTemplate,
  insertTemplateSet,
  insertTemplateShare,
  listAllSets,
  listAllTemplates,
  listInboundSetIdsHoldingTemplate,
  listVisibleSets,
  listVisibleTemplates,
  loadSetById,
  loadTemplateById,
  parseStarterPackFlag,
  removeTemplateFromSet,
  replaceSetItems,
  replaceTemplateRecipe,
  setIsSharedWith,
  templateIsSharedWith,
  updateSetMeta,
  updateTemplateMeta,
  type AutomationTemplate,
  type AutomationTemplateSet,
} from "./store";
import {
  buildTemplateLibraryFile,
  parseShareEmail,
  parseTemplateLibraryJson,
  planLibraryImport,
  filterLibraryFile,
  selectLibraryExport,
  type LibraryImportPlan,
} from "./transfer";

export type TemplateActionResult = {
  ok: boolean;
  error?: string;
  code?: "name_taken" | "symbol_taken" | "desk_type" | "forbidden" | "already_shared";
  symbol?: string;
  notes?: string[];
  results?: ApplyItemResult[];
  applied?: AppliedDeskItem[];
  json?: string;
  filename?: string;
  templateId?: string;
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
  if (visibility === "platform" || (visibility === "backtested" && !ownerId)) {
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

function folderCanHoldTemplate(
  folder: AutomationTemplateSet,
  template: AutomationTemplate,
  userId: string,
  isAdmin: boolean,
): boolean {
  if (folder.deskType !== template.deskType) {
    return false;
  }
  if (!canManageRow(folder.visibility, folder.userId, userId, isAdmin)) {
    return false;
  }
  if (template.visibility === "platform") {
    return (
      folder.visibility === "platform" ||
      (folder.visibility === "user" && folder.userId === userId)
    );
  }
  return folder.visibility === "user" && folder.userId === template.userId;
}

async function syncTemplateFolders(input: {
  template: AutomationTemplate;
  userId: string;
  isAdmin: boolean;
  folderIds: string[];
  newFolderName: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; code?: "name_taken" }> {
  const folders = input.isAdmin
    ? await listAllSets()
    : await listVisibleSets({ userId: input.userId });
  const candidates = folders.filter((folder) =>
    folderCanHoldTemplate(folder, input.template, input.userId, input.isAdmin),
  );
  const wanted = new Set(input.folderIds);
  for (const folder of candidates) {
    const has = folder.items.some((item) => item.templateId === input.template.id);
    const want = wanted.has(folder.id);
    if (want && !has) {
      const added = await appendTemplateToSet({
        setId: folder.id,
        templateId: input.template.id,
      });
      if (!added.ok) {
        return added;
      }
    }
    if (!want && has) {
      const removed = await removeTemplateFromSet({
        setId: folder.id,
        templateId: input.template.id,
      });
      if (!removed.ok) {
        return removed;
      }
    }
  }
  if (input.newFolderName) {
    const created = await insertTemplateSet({
      userId:
        input.template.visibility === "platform" ? null : input.template.userId,
      visibility: input.template.visibility,
      deskType: input.template.deskType,
      name: input.newFolderName,
      description: null,
      templateIds: [input.template.id],
    });
    if (!created.ok) {
      return created;
    }
  }
  return { ok: true };
}

function parseFolderName(raw: unknown) {
  const parsed = parseTemplateName(raw);
  if (!parsed.ok && parsed.error === "Enter a template name.") {
    return { ok: false as const, error: "Enter a folder name." };
  }
  return parsed;
}

async function writableFolderForSave(input: {
  setId: string;
  userId: string;
  isAdmin: boolean;
  visibility: TemplateVisibility;
  deskType: TemplateDeskType;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const set = await loadSetById(input.setId);
  if (
    !set ||
    !canManageRow(set.visibility, set.userId, input.userId, input.isAdmin)
  ) {
    return { ok: false, error: "That folder was not found." };
  }
  if (set.deskType !== input.deskType) {
    return { ok: false, error: "That folder does not match this desk type." };
  }
  if (set.visibility === "platform" && input.visibility !== "platform") {
    return { ok: false, error: "Platform folders may only contain platform templates." };
  }
  return { ok: true };
}

async function addTemplateToExistingFolder(input: {
  setId: string;
  templateId: string;
  userId: string;
  isAdmin: boolean;
  visibility: TemplateVisibility;
  deskType: TemplateDeskType;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const allowed = await writableFolderForSave(input);
  if (!allowed.ok) {
    return allowed;
  }
  return appendTemplateToSet({ setId: input.setId, templateId: input.templateId });
}

export async function placeSavedTemplate(input: {
  templateId: string;
  userId: string;
  isAdmin: boolean;
  visibility: TemplateVisibility;
  deskType: TemplateDeskType;
  folderIds: string[];
  newFolderName: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const member = await getSessionMember();
  if (!member) {
    return { ok: false, error: "Sign in to continue." };
  }
  const isAdmin = memberIsAdmin(member);
  input = {
    ...input,
    userId: member.id,
    isAdmin,
  };
  if (input.newFolderName) {
    const folderName = parseFolderName(input.newFolderName);
    if (!folderName.ok) {
      return folderName;
    }
    input = { ...input, newFolderName: folderName.name };
  }
  for (const folderId of input.folderIds) {
    const added = await addTemplateToExistingFolder({
      setId: folderId,
      templateId: input.templateId,
      userId: input.userId,
      isAdmin: input.isAdmin,
      visibility: input.visibility,
      deskType: input.deskType,
    });
    if (!added.ok) {
      return {
        ok: false,
        error: `Template saved. Could not add it to that folder: ${added.error}`,
      };
    }
  }
  if (input.newFolderName) {
    const created = await insertTemplateSet({
      userId: input.visibility === "platform" ? null : input.userId,
      visibility: input.visibility,
      deskType: input.deskType,
      name: input.newFolderName,
      description: null,
      templateIds: [input.templateId],
    });
    if (!created.ok) {
      return {
        ok: false,
        error: `Template saved. Could not create the folder: ${created.error}`,
      };
    }
  }
  return { ok: true };
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
  folderIds: string[];
  newFolderName: string | null;
  starterPack?: boolean;
}): Promise<TemplateActionResult> {
  if (input.newFolderName) {
    const folderName = parseFolderName(input.newFolderName);
    if (!folderName.ok) {
      return folderName;
    }
    input = { ...input, newFolderName: folderName.name };
  }
  for (const folderId of input.folderIds) {
    const allowed = await writableFolderForSave({
      setId: folderId,
      userId: input.userId,
      isAdmin: input.isAdmin,
      visibility: input.visibility,
      deskType: input.deskType,
    });
    if (!allowed.ok) {
      return allowed;
    }
  }
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
      const flagged = await updateTemplateMeta({
        id: existing.id,
        name: input.name,
        description: input.description,
        visibility: input.visibility,
        starterPack: input.starterPack,
      });
      if (!flagged.ok) {
        return flagged;
      }
      await writeEventLog({
        scope: "strategy",
        event: "template.saved",
        message: `Replaced template ${input.name}`,
        userId: input.userId,
        data: { template_id: existing.id, desk_type: input.deskType },
      });
      const placed = await placeSavedTemplate({
        templateId: existing.id,
        userId: input.userId,
        isAdmin: input.isAdmin,
        visibility: input.visibility,
        deskType: input.deskType,
        folderIds: input.folderIds,
        newFolderName: input.newFolderName,
      });
      revalidateTemplateSurfaces();
      if (!placed.ok) {
        return placed;
      }
      return { ok: true, templateId: existing.id };
    }
  }
  const inserted = await insertTemplate({
    userId: input.visibility === "platform" ? null : input.userId,
    visibility: input.visibility,
    deskType: input.deskType,
    name: input.name,
    description: input.description,
    recipe: input.recipe,
    starterPack: input.starterPack,
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
  const placed = await placeSavedTemplate({
    templateId: inserted.template.id,
    userId: input.userId,
    isAdmin: input.isAdmin,
    visibility: input.visibility,
    deskType: input.deskType,
    folderIds: input.folderIds,
    newFolderName: input.newFolderName,
  });
  revalidateTemplateSurfaces();
  if (!placed.ok) {
    return placed;
  }
  return { ok: true, templateId: inserted.template.id };
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
    folderIds: formData
      .getAll("folderId")
      .map((value) => String(value).trim())
      .filter(Boolean),
    newFolderName: String(formData.get("newFolderName") ?? "").trim() || null,
    starterPack: parseStarterPackFlag(
      formData.get("starterPack"),
      visibility.visibility,
    ),
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
    folderIds: meta.folderIds,
    newFolderName: meta.newFolderName,
    starterPack: meta.starterPack,
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
    folderIds: meta.folderIds,
    newFolderName: meta.newFolderName,
    starterPack: meta.starterPack,
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
    return { ok: false, error: "That bot is incomplete." };
  }
  return saveNamedRecipe({
    userId: auth.member.id,
    isAdmin: auth.isAdmin,
    visibility: meta.visibility,
    deskType: "cash_and_carry",
    name: meta.name,
    description: meta.description,
    replace: meta.replace,
    folderIds: meta.folderIds,
    newFolderName: meta.newFolderName,
    starterPack: meta.starterPack,
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
    visibility: template.visibility,
    starterPack: parseStarterPackFlag(
      formData.get("starterPack"),
      template.visibility,
    ),
  });
  if (!updated.ok) {
    return updated;
  }
  const folderIds = String(formData.get("folderIds") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const newFolderRaw = String(formData.get("newFolderName") ?? "").trim();
  let newFolderName: string | null = null;
  if (newFolderRaw) {
    const parsedFolder = parseTemplateName(newFolderRaw);
    if (!parsedFolder.ok) {
      return {
        ok: false,
        error:
          parsedFolder.error === "Enter a template name."
            ? "Enter a folder name."
            : parsedFolder.error,
      };
    }
    newFolderName = parsedFolder.name;
  }
  if (formData.has("folderIds") || newFolderName) {
    const synced = await syncTemplateFolders({
      template,
      userId: auth.member.id,
      isAdmin: auth.isAdmin,
      folderIds,
      newFolderName,
    });
    if (!synced.ok) {
      return synced;
    }
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
  const published = await publishTemplateCopy({
    template,
    name: name.name,
    description: parseTemplateDescription(
      formData.get("templateDescription") ?? template.description,
    ),
    starterPack: parseStarterPackFlag(
      formData.get("starterPack"),
      "platform",
    ),
    actorId: auth.member.id,
  });
  if (!published.ok) {
    return published;
  }
  revalidateTemplateSurfaces();
  return { ok: true };
}

async function publishTemplateCopy(input: {
  template: AutomationTemplate;
  name: string;
  description: string | null;
  starterPack?: boolean;
  actorId: string;
}): Promise<
  | { ok: true; templateId: string }
  | { ok: false; error: string; code?: "name_taken" }
> {
  const inserted = await insertTemplate({
    userId: null,
    visibility: "platform",
    deskType: input.template.deskType,
    name: input.name,
    description: input.description,
    recipe: input.template.recipe,
    starterPack: input.starterPack,
  });
  if (!inserted.ok) {
    return inserted;
  }
  await writeEventLog({
    scope: "strategy",
    event: "template.saved",
    message: `Published platform template ${input.name}`,
    userId: input.actorId,
    data: {
      template_id: inserted.template.id,
      source_id: input.template.id,
      desk_type: input.template.deskType,
    },
  });
  return { ok: true, templateId: inserted.template.id };
}

function parseBulkIds(formData: FormData): string[] {
  return String(formData.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function bulkLibraryAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const kind = String(formData.get("kind") ?? "");
  const op = String(formData.get("op") ?? "");
  const ids = parseBulkIds(formData);
  if (ids.length === 0) {
    return { ok: false, error: "Select at least one row." };
  }
  if (kind !== "template" && kind !== "folder") {
    return { ok: false, error: "Choose templates or folders." };
  }
  if (
    op !== "add-to-folder" &&
    op !== "publish" &&
    op !== "unpublish" &&
    op !== "delete"
  ) {
    return { ok: false, error: "Choose a bulk action." };
  }
  if ((op === "publish" || op === "unpublish") && !auth.isAdmin) {
    return { ok: false, error: "Only admins can publish or unpublish." };
  }
  const notes: string[] = [];
  let done = 0;

  if (kind === "template" && op === "add-to-folder") {
    const added = await bulkAddTemplatesToFolder({
      ids,
      userId: auth.member.id,
      isAdmin: auth.isAdmin,
      folderId: String(formData.get("folderId") ?? "").trim() || null,
      newFolderName: String(formData.get("newFolderName") ?? "").trim() || null,
    });
    if (!added.ok) {
      return added;
    }
    notes.push(...added.notes);
    done = added.done;
  } else if (kind === "template") {
    for (const id of ids) {
      const template = await loadTemplateById(id);
      if (!template) {
        notes.push("Skipped a missing template.");
        continue;
      }
      if (op === "publish") {
        if (template.visibility === "platform") {
          notes.push(`Skipped “${template.name}”: already a platform template.`);
          continue;
        }
        if (!canReadTemplate(template, auth.member.id, true)) {
          notes.push(`Skipped “${template.name}”.`);
          continue;
        }
        const published = await publishTemplateCopy({
          template,
          name: template.name,
          description: template.description,
          actorId: auth.member.id,
        });
        if (!published.ok) {
          notes.push(`Skipped “${template.name}”: ${published.error}`);
          continue;
        }
        done += 1;
        continue;
      }
      if (op === "unpublish") {
        if (template.visibility !== "platform") {
          notes.push(`Skipped “${template.name}”: not a platform template.`);
          continue;
        }
        if (!canManageTemplate(template, auth.member.id, auth.isAdmin)) {
          notes.push(`Skipped “${template.name}”.`);
          continue;
        }
        const deleted = await deleteTemplate(id);
        if (!deleted.ok) {
          notes.push(`Skipped “${template.name}”: ${deleted.error}`);
          continue;
        }
        done += 1;
        continue;
      }
      if (!canManageTemplate(template, auth.member.id, auth.isAdmin)) {
        notes.push(`Skipped “${template.name}”.`);
        continue;
      }
      const deleted = await deleteTemplate(id);
      if (!deleted.ok) {
        notes.push(`Skipped “${template.name}”: ${deleted.error}`);
        continue;
      }
      done += 1;
    }
  } else if (op === "add-to-folder") {
    return { ok: false, error: "Add to folder is for templates." };
  } else {
    for (const id of ids) {
      const folder = await loadSetById(id);
      if (!folder) {
        notes.push("Skipped a missing folder.");
        continue;
      }
      if (op === "publish") {
        if (folder.visibility === "platform") {
          notes.push(`Skipped “${folder.name}”: already a platform folder.`);
          continue;
        }
        if (!canManageRow(folder.visibility, folder.userId, auth.member.id, auth.isAdmin)) {
          notes.push(`Skipped “${folder.name}”.`);
          continue;
        }
        const published = await publishFolderCopy({
          folder,
          actorId: auth.member.id,
        });
        if (!published.ok) {
          notes.push(`Skipped “${folder.name}”: ${published.error}`);
          continue;
        }
        notes.push(...published.notes);
        done += 1;
        continue;
      }
      if (op === "unpublish") {
        if (folder.visibility !== "platform") {
          notes.push(`Skipped “${folder.name}”: not a platform folder.`);
          continue;
        }
        if (!canManageRow(folder.visibility, folder.userId, auth.member.id, auth.isAdmin)) {
          notes.push(`Skipped “${folder.name}”.`);
          continue;
        }
        const deleted = await deleteTemplateSet(id);
        if (!deleted.ok) {
          notes.push(`Skipped “${folder.name}”: ${deleted.error}`);
          continue;
        }
        done += 1;
        continue;
      }
      if (!canManageRow(folder.visibility, folder.userId, auth.member.id, auth.isAdmin)) {
        notes.push(`Skipped “${folder.name}”.`);
        continue;
      }
      const deleted = await deleteTemplateSet(id);
      if (!deleted.ok) {
        notes.push(`Skipped “${folder.name}”: ${deleted.error}`);
        continue;
      }
      done += 1;
    }
  }

  revalidateTemplateSurfaces();
  const label = kind === "template" ? "template" : "folder";
  notes.unshift(
    `Updated ${done} ${label}${done === 1 ? "" : "s"}.`,
  );
  return { ok: true, notes };
}

async function bulkAddTemplatesToFolder(input: {
  ids: string[];
  userId: string;
  isAdmin: boolean;
  folderId: string | null;
  newFolderName: string | null;
}): Promise<
  | { ok: true; done: number; notes: string[] }
  | { ok: false; error: string }
> {
  const loaded: AutomationTemplate[] = [];
  for (const id of input.ids) {
    const template = await loadTemplateById(id);
    if (
      !template ||
      !canReadTemplate(template, input.userId, input.isAdmin)
    ) {
      continue;
    }
    loaded.push(template);
  }
  if (loaded.length === 0) {
    return { ok: false, error: "Those templates were not found." };
  }
  const deskType = loaded[0]?.deskType;
  if (!deskType || loaded.some((row) => row.deskType !== deskType)) {
    return { ok: false, error: "Select templates of one desk type." };
  }
  const notes: string[] = [];
  let folderId = input.folderId;
  if (input.newFolderName) {
    const parsed = parseFolderName(input.newFolderName);
    if (!parsed.ok) {
      return parsed;
    }
    const allPlatform = loaded.every((row) => row.visibility === "platform");
    const userOwners = [
      ...new Set(
        loaded
          .filter((row) => row.visibility === "user")
          .map((row) => row.userId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (!allPlatform && userOwners.length > 1) {
      return {
        ok: false,
        error: "Select templates from one owner to create a folder.",
      };
    }
    const visibility =
      allPlatform && input.isAdmin ? "platform" : "user";
    if (visibility === "platform" && !allPlatform) {
      return {
        ok: false,
        error: "Platform folders may only contain platform templates.",
      };
    }
    const created = await insertTemplateSet({
      userId: visibility === "platform" ? null : (userOwners[0] ?? input.userId),
      visibility,
      deskType,
      name: parsed.name,
      description: null,
      templateIds: [],
    });
    if (!created.ok) {
      return created;
    }
    folderId = created.set.id;
  }
  if (!folderId) {
    return { ok: false, error: "Choose a folder or create one." };
  }
  const folder = await loadSetById(folderId);
  if (
    !folder ||
    !canManageRow(folder.visibility, folder.userId, input.userId, input.isAdmin)
  ) {
    return { ok: false, error: "That folder was not found." };
  }
  if (folder.deskType !== deskType) {
    return { ok: false, error: "That folder does not match this desk type." };
  }
  let done = 0;
  for (const template of loaded) {
    if (folder.visibility === "platform" && template.visibility !== "platform") {
      notes.push(`Skipped “${template.name}”: platform folders need platform templates.`);
      continue;
    }
    const added = await appendTemplateToSet({
      setId: folder.id,
      templateId: template.id,
    });
    if (!added.ok) {
      notes.push(`Skipped “${template.name}”: ${added.error}`);
      continue;
    }
    done += 1;
  }
  return { ok: true, done, notes };
}

async function publishFolderCopy(input: {
  folder: AutomationTemplateSet;
  actorId: string;
}): Promise<
  | { ok: true; notes: string[] }
  | { ok: false; error: string }
> {
  const notes: string[] = [];
  const platformIds: string[] = [];
  for (const item of input.folder.items) {
    const template = await loadTemplateById(item.templateId);
    if (!template) {
      notes.push(`Skipped a missing template in “${input.folder.name}”.`);
      continue;
    }
    if (template.visibility === "platform") {
      platformIds.push(template.id);
      continue;
    }
    const published = await publishTemplateCopy({
      template,
      name: template.name,
      description: template.description,
      actorId: input.actorId,
    });
    if (!published.ok) {
      notes.push(`Skipped “${template.name}”: ${published.error}`);
      continue;
    }
    platformIds.push(published.templateId);
  }
  if (platformIds.length === 0) {
    return { ok: false, error: "No platform templates to put in that folder." };
  }
  const created = await insertTemplateSet({
    userId: null,
    visibility: "platform",
    deskType: input.folder.deskType,
    name: input.folder.name,
    description: input.folder.description,
    templateIds: platformIds,
  });
  if (!created.ok) {
    return created;
  }
  return { ok: true, notes };
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
    await writeEventLog({
      scope: "strategy",
      event: "template.applied",
      message: `Applied template ${result.name}`,
      userId: session.member.id,
      accountId,
      data: { template_id: templateId },
    });
    revalidatePath("/account/templates");
    revalidatePath("/admin/templates");
  }
  return {
    ok: result.ok,
    error: result.error,
    code: result.code,
    symbol: result.symbol,
    notes: result.notes,
    results: [result],
    applied: result.applied ? [result.applied] : undefined,
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
    message: `Applied template folder`,
    userId: session.member.id,
    accountId,
    data: { set_id: setId },
  });
  revalidatePath("/account/templates");
  revalidatePath("/admin/templates");
  return {
    ok: true,
    results: applied.results,
    applied: applied.results
      .map((row) => row.applied)
      .filter((row): row is AppliedDeskItem => Boolean(row)),
  };
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
  for (const id of ids) {
    const template = await loadTemplateById(id);
    if (!template || !canReadTemplate(template, auth.member.id, auth.isAdmin)) {
      return { ok: false, error: "One of those templates was not found." };
    }
    if (template.deskType !== deskTypeRaw) {
      return { ok: false, error: "Every template in a folder must share a desk type." };
    }
    if (meta.visibility === "platform" && template.visibility !== "platform") {
      return { ok: false, error: "Platform folders may only contain platform templates." };
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
    starterPack: meta.starterPack,
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
    return { ok: false, error: "That folder was not found.", code: "forbidden" };
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
    visibility: set.visibility,
    starterPack: parseStarterPackFlag(formData.get("starterPack"), set.visibility),
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
    return { ok: false, error: "That folder was not found.", code: "forbidden" };
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
    return { ok: false, error: "That folder was not found.", code: "forbidden" };
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
    message: `Shared folder ${set.name} with ${member.email}`,
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
  const inboundSetIds = isRecipient
    ? await listInboundSetIdsHoldingTemplate(auth.member.id, id)
    : [];
  const canRevoke =
    canShareRow(template.visibility, template.userId, auth.member.id, auth.isAdmin) ||
    (isRecipient &&
      ((await hasDirectTemplateShare(auth.member.id, id)) ||
        inboundSetIds.length > 0));
  if (!canRevoke) {
    return { ok: false, error: "That share was not found.", code: "forbidden" };
  }
  const deleted = await deleteTemplateShare({ templateId: id, toUserId });
  if (!deleted.ok) {
    return deleted;
  }
  if (isRecipient) {
    for (const setId of inboundSetIds) {
      const dropped = await deleteSetShare({
        setId,
        toUserId: auth.member.id,
      });
      if (!dropped.ok) {
        return dropped;
      }
    }
  }
  revalidateTemplateSurfaces();
  return {
    ok: true,
    notes: isRecipient ? ["Removed the share."] : undefined,
  };
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
    return { ok: false, error: "That folder was not found.", code: "forbidden" };
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
  return {
    ok: true,
    notes: isRecipient ? ["Removed the share."] : undefined,
  };
}

async function ownLibraryNames(userId: string) {
  const existingTemplates = (
    await listVisibleTemplates({ userId })
  ).filter((row) => row.visibility === "user" && row.userId === userId);
  const existingSets = (
    await listVisibleSets({ userId })
  ).filter((row) => row.visibility === "user" && row.userId === userId);
  return {
    templates: existingTemplates.map((row) => ({
      deskType: row.deskType,
      name: row.name,
    })),
    sets: existingSets.map((row) => ({
      deskType: row.deskType,
      name: row.name,
    })),
  };
}

async function writeUserLibraryImport(
  userId: string,
  plan: LibraryImportPlan,
): Promise<TemplateActionResult> {
  if (plan.templates.length === 0 && plan.sets.length === 0) {
    return { ok: false, error: "Nothing to import." };
  }
  const idMap = new Map<string, string>();
  const notes = [...plan.notes];
  for (const row of plan.templates) {
    const inserted = await insertTemplate({
      userId,
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
      notes.push(`Skipped folder “${row.name}”: none of its templates imported.`);
      continue;
    }
    const inserted = await insertTemplateSet({
      userId,
      visibility: "user",
      deskType: row.deskType,
      name: row.name,
      description: row.description,
      templateIds,
    });
    if (!inserted.ok) {
      notes.push(`Skipped folder “${row.name}”: ${inserted.error}`);
    }
  }
  const importedTemplates = idMap.size;
  const importedSets = plan.sets.filter((row) =>
    row.sourceItemIds.some((id) => idMap.has(id)),
  ).length;
  await writeEventLog({
    scope: "strategy",
    event: "template.imported",
    message: `Imported ${importedTemplates} templates and ${importedSets} folders`,
    userId,
    data: {
      templates: importedTemplates,
      sets: importedSets,
    },
  });
  revalidateTemplateSurfaces();
  notes.unshift(
    `Imported ${importedTemplates} template${importedTemplates === 1 ? "" : "s"} and ${importedSets} folder${importedSets === 1 ? "" : "s"}.`,
  );
  return { ok: true, notes };
}

export async function importSharedTemplateAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const id = String(formData.get("templateId") ?? "").trim();
  const template = await loadTemplateById(id);
  if (!template || !(await templateIsSharedWith(auth.member.id, id))) {
    return { ok: false, error: "That template was not found.", code: "forbidden" };
  }
  const plan = planLibraryImport(
    buildTemplateLibraryFile({
      templates: [template],
      sets: [],
    }),
    await ownLibraryNames(auth.member.id),
  );
  return writeUserLibraryImport(auth.member.id, plan);
}

export async function importSharedSetAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const id = String(formData.get("setId") ?? "").trim();
  const set = await loadSetById(id);
  if (!set || !(await setIsSharedWith(auth.member.id, id))) {
    return { ok: false, error: "That folder was not found.", code: "forbidden" };
  }
  const templates: AutomationTemplate[] = [];
  for (const item of set.items) {
    const template = await loadTemplateById(item.templateId);
    if (template) {
      templates.push(template);
    }
  }
  if (templates.length === 0) {
    return { ok: false, error: "That folder has no templates to import." };
  }
  const plan = planLibraryImport(
    buildTemplateLibraryFile({
      templates,
      sets: [set],
    }),
    await ownLibraryNames(auth.member.id),
  );
  return writeUserLibraryImport(auth.member.id, plan);
}

export async function exportTemplateLibraryAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const scope = String(formData.get("scope") ?? "own");
  if ((scope === "all" || scope === "platform") && !auth.isAdmin) {
    return {
      ok: false,
      error: "Only admins can export the platform catalog.",
      code: "forbidden",
    };
  }
  let templates =
    scope === "all"
      ? await listAllTemplates()
      : scope === "platform"
        ? await listAllTemplates({ visibility: "platform" })
        : (await listVisibleTemplates({ userId: auth.member.id })).filter(
            (row) => row.visibility === "user" && row.userId === auth.member.id,
          );
  let sets =
    scope === "all"
      ? await listAllSets()
      : scope === "platform"
        ? await listAllSets({ visibility: "platform" })
        : (await listVisibleSets({ userId: auth.member.id })).filter(
            (row) => row.visibility === "user" && row.userId === auth.member.id,
          );
  const ids = parseBulkIds(formData);
  const kind = String(formData.get("kind") ?? "");
  if (ids.length > 0) {
    if (kind !== "template" && kind !== "folder") {
      return { ok: false, error: "Choose templates or folders." };
    }
    const picked = selectLibraryExport({ templates, sets }, { kind, ids });
    templates = picked.templates;
    sets = picked.sets;
    if (templates.length === 0 && sets.length === 0) {
      return { ok: false, error: "None of those rows could be exported." };
    }
  }
  const file = buildTemplateLibraryFile({ templates, sets });
  const day = file.exportedAt.slice(0, 10);
  const selected = ids.length > 0;
  return {
    ok: true,
    json: `${JSON.stringify(file, null, 2)}\n`,
    filename:
      scope === "platform"
        ? selected
          ? `tbp-platform-selected-${day}.json`
          : `tbp-platform-templates-${day}.json`
        : selected
          ? `tbp-selected-templates-${day}.json`
          : `tbp-templates-${day}.json`,
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
  let file = parsed.file;
  if (formData.has("templateIds") || formData.has("setIds")) {
    file = filterLibraryFile(file, {
      templateIds: String(formData.get("templateIds") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
      setIds: String(formData.get("setIds") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    });
  }
  const existing = await ownLibraryNames(auth.member.id);
  const plan = planLibraryImport(file, existing);
  return writeUserLibraryImport(auth.member.id, plan);
}
