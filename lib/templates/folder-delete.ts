import type { TemplateVisibility } from "./recipe";

export type FolderTemplateRef = {
  id: string;
  visibility: TemplateVisibility;
  userId: string | null;
};

function templateBelongsToFolder(
  folderVisibility: TemplateVisibility,
  folderUserId: string | null,
  template: FolderTemplateRef,
): boolean {
  if (folderVisibility === "platform") {
    return template.visibility === "platform";
  }
  if (folderVisibility !== "user" || !folderUserId) {
    return false;
  }
  return template.visibility === "user" && template.userId === folderUserId;
}

function actorCanDeleteTemplate(
  template: FolderTemplateRef,
  actorId: string,
  isAdmin: boolean,
): boolean {
  if (
    template.visibility === "platform" ||
    (template.visibility === "backtested" && !template.userId)
  ) {
    return isAdmin;
  }
  return template.userId === actorId || isAdmin;
}

/** Templates removed when a folder delete also deletes its templates. */
export function templateIdsDeletedWithFolder(input: {
  folderVisibility: TemplateVisibility;
  folderUserId: string | null;
  actorId: string;
  isAdmin: boolean;
  templates: FolderTemplateRef[];
}): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const template of input.templates) {
    if (seen.has(template.id)) {
      continue;
    }
    if (
      !templateBelongsToFolder(
        input.folderVisibility,
        input.folderUserId,
        template,
      )
    ) {
      continue;
    }
    if (!actorCanDeleteTemplate(template, input.actorId, input.isAdmin)) {
      continue;
    }
    seen.add(template.id);
    ids.push(template.id);
  }
  return ids;
}
