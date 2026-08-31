"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PanelCloseButton } from "@/components/panel-close-button";
import {
  applyTemplateAction,
  saveDcaAsTemplateAction,
  savePaperAsTemplateAction,
  savePerpsAsTemplateAction,
  type TemplateActionResult,
} from "@/lib/templates/actions";
import type { AppliedDeskItem } from "@/lib/templates/apply";
import type {
  AutomationTemplateSet,
  TemplateSummary,
} from "@/lib/templates/store";
import type { TemplateDeskType } from "@/lib/templates/recipe";
import { formatDeskType } from "@/lib/accounts/model";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";
const primaryBtn =
  "rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent";
const secondaryBtn =
  "rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong";

export function StarterPackCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="mt-3 flex items-start gap-2 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4"
      />
      Include in Starter Pack
    </label>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  size,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  size?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined") {
    return null;
  }
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-card border border-line bg-surface-raised p-5 ${
          size === "xl"
            ? "max-w-3xl"
            : size === "lg" || wide
              ? "max-w-2xl"
              : "max-w-lg"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <PanelCloseButton onClick={onClose} />
        <h2 className="pr-8 text-lg font-semibold text-ink">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function ResultNote({ result }: { result: TemplateActionResult | null }) {
  if (!result) {
    return null;
  }
  if (!result.ok) {
    return (
      <p className="mt-3 rounded-card border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
        {result.error ?? "That did not work."}
      </p>
    );
  }
  const notes = [
    ...(result.notes ?? []),
    ...(result.results ?? []).flatMap((row) => row.notes),
  ];
  if (notes.length === 0) {
    return (
      <p className="mt-3 text-sm text-success">Saved.</p>
    );
  }
  return (
    <ul className="mt-3 space-y-1 text-sm text-ink-muted">
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}

export function SaveAsTemplateButton({
  isAdmin,
  defaultName,
  buildForm,
  kind,
  folders = [],
  onSaved,
}: {
  isAdmin: boolean;
  defaultName: string;
  buildForm: () => FormData;
  kind: TemplateDeskType;
  folders?: AutomationTemplateSet[];
  onSaved?: (templateId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<TemplateActionResult | null>(null);
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState(false);
  const [replace, setReplace] = useState(false);
  const [folderIds, setFolderIds] = useState<Set<string>>(new Set());
  const [createFolder, setCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [starterPack, setStarterPack] = useState(false);

  const folderGroups = saveFolderGroups(folders, kind, platform);

  function toggleFolder(id: string) {
    setFolderIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function resetAndOpen(asPlatform: boolean) {
    setName(defaultName);
    setDescription("");
    setPlatform(asPlatform);
    setReplace(false);
    setFolderIds(new Set());
    setCreateFolder(false);
    setNewFolderName("");
    setStarterPack(false);
    setResult(null);
    setOpen(true);
  }

  async function onSave() {
    setPending(true);
    const data = buildForm();
    data.set("templateName", name);
    data.set("templateDescription", description);
    data.set("visibility", platform ? "platform" : "user");
    if (replace) {
      data.set("replaceExisting", "1");
    }
    for (const id of folderIds) {
      data.append("folderId", id);
    }
    if (createFolder && newFolderName.trim()) {
      data.set("newFolderName", newFolderName.trim());
    }
    if (platform && starterPack) {
      data.set("starterPack", "1");
    }
    const action =
      kind === "dca"
        ? saveDcaAsTemplateAction
        : kind === "perps"
          ? savePerpsAsTemplateAction
          : savePaperAsTemplateAction;
    const next = await action(data);
    setResult(next);
    setPending(false);
    if (next.ok) {
      setOpen(false);
      if (next.templateId) {
        onSaved?.(next.templateId);
      }
    }
    if (next.code === "name_taken") {
      setReplace(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => resetAndOpen(false)}
        className="shrink-0 rounded-control px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink"
      >
        Save as template
      </button>
      {isAdmin ? (
        <button
          type="button"
          onClick={() => resetAndOpen(true)}
          className="shrink-0 rounded-control px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink"
        >
          Save as platform template
        </button>
      ) : null}
      {open ? (
        <Modal
          title={platform ? "Save as platform template" : "Save as template"}
          onClose={() => setOpen(false)}
        >
          <p className="mt-1 text-sm text-ink-muted">
            {platform
              ? "Visible to every member. Confirm the name before publishing."
              : "Saved to your template library. Apply it later on any matching desk."}
          </p>
          <label className="mt-4 block text-xs text-ink-muted">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              className={fieldClass}
            />
          </label>
          <label className="mt-3 block text-xs text-ink-muted">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className={fieldClass}
            />
          </label>
          {platform ? (
            <StarterPackCheckbox
              checked={starterPack}
              onChange={setStarterPack}
            />
          ) : null}
          <div className="mt-3">
            <p className="text-xs text-ink-muted">Add to folder</p>
            {folderGroups.length === 0 ? (
              <p className="mt-1 text-sm text-ink-faint">
                {platform
                  ? "None yet. Create one below."
                  : "None yet. Create one below or on My Folders."}
              </p>
            ) : (
              <div className="mt-1 space-y-3">
                {folderGroups.map((group) => (
                  <div key={group.label}>
                    {folderGroups.length > 1 ? (
                      <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                        {group.label}
                      </p>
                    ) : null}
                    <ul className="mt-1 space-y-1 rounded-control border border-line bg-canvas px-3 py-2">
                      {group.rows.map((row) => (
                        <li key={row.id}>
                          <label className="flex items-start gap-2 text-sm text-ink">
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4"
                              checked={folderIds.has(row.id)}
                              onChange={() => toggleFolder(row.id)}
                            />
                            <span>
                              <span className="block font-medium">{row.name}</span>
                              <span className="block text-xs text-ink-muted">
                                {row.items.length === 0
                                  ? "Empty folder"
                                  : `${row.items.length} template${row.items.length === 1 ? "" : "s"}`}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={createFolder}
              onChange={(event) => setCreateFolder(event.target.checked)}
              className="mt-1 size-4"
            />
            {platform ? "Create a new platform folder" : "Create a new folder"}
          </label>
          {createFolder ? (
            <label className="mt-2 block text-xs text-ink-muted">
              Folder name
              <input
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                maxLength={80}
                className={fieldClass}
              />
            </label>
          ) : null}
          {result?.code === "name_taken" ? (
            <label className="mt-3 flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={replace}
                onChange={(event) => setReplace(event.target.checked)}
                className="mt-1 size-4"
              />
              Replace the existing template with this name
            </label>
          ) : null}
          <ResultNote result={result} />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className={secondaryBtn}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={pending || (createFolder && !newFolderName.trim())}
              className={primaryBtn}
            >
              {pending ? "Saving…" : "Save template"}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function saveFolderGroups(
  folders: AutomationTemplateSet[],
  kind: TemplateDeskType,
  asPlatform: boolean,
): { label: string; rows: AutomationTemplateSet[] }[] {
  const matching = folders.filter(
    (row) => row.deskType === kind && !row.sharedByEmail,
  );
  if (asPlatform) {
    const platformRows = matching.filter((row) => row.visibility === "platform");
    return platformRows.length > 0
      ? [{ label: "Platform folders", rows: platformRows }]
      : [];
  }
  const mine = matching.filter((row) => row.visibility === "user");
  return mine.length > 0 ? [{ label: "My folders", rows: mine }] : [];
}

export function DeskTemplateBar({
  deskType,
  accountId,
  templates,
  sets,
  onApplied,
}: {
  deskType: TemplateDeskType;
  accountId: string;
  templates: TemplateSummary[];
  sets: AutomationTemplateSet[];
  onApplied?: (items: AppliedDeskItem[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ApplyFromLibraryButton
        deskType={deskType}
        accountId={accountId}
        templates={templates}
        sets={sets}
        onApplied={onApplied}
      />
    </div>
  );
}

function ApplyFromLibraryButton({
  deskType,
  accountId,
  templates,
  sets,
  onApplied,
}: {
  deskType: TemplateDeskType;
  accountId: string;
  templates: TemplateSummary[];
  sets: AutomationTemplateSet[];
  onApplied?: (items: AppliedDeskItem[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<TemplateActionResult | null>(null);
  const selected = templates.filter((row) => selectedIds.has(row.id));
  const tree = libraryTree(
    templates.filter((row) => row.deskType === deskType),
    sets.filter((row) => row.deskType === deskType),
  );

  function toggleTemplate(id: string) {
    setResult(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleFolder(ids: string[]) {
    setResult(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      const allOn = ids.length > 0 && ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allOn) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  }

  async function onApply() {
    if (selected.length === 0) {
      return;
    }
    setPending(true);
    const results: NonNullable<TemplateActionResult["results"]> = [];
    const applied: NonNullable<TemplateActionResult["applied"]> = [];
    const notes: string[] = [];
    let firstError: string | undefined;
    for (const row of selected) {
      const data = new FormData();
      data.set("templateId", row.id);
      data.set("accountId", accountId);
      const next = await applyTemplateAction(data);
      if (next.results) {
        results.push(...next.results);
      }
      if (next.applied) {
        applied.push(...next.applied);
      }
      if (next.notes) {
        notes.push(...next.notes);
      }
      if (!next.ok && !firstError) {
        firstError = next.error;
      }
    }
    const merged: TemplateActionResult = {
      ok: applied.length > 0 || results.some((row) => row.ok && !row.skipped),
      error: applied.length === 0 ? firstError : undefined,
      notes,
      results,
      applied: applied.length > 0 ? applied : undefined,
    };
    setResult(merged);
    setPending(false);
    if (merged.applied && merged.applied.length > 0) {
      onApplied?.(merged.applied);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={secondaryBtn}>
        Add from Template
      </button>
      {open ? (
        <Modal title="Add from Template" onClose={() => setOpen(false)} wide>
          <p className="mt-1 text-sm text-ink-muted">
            Tick a folder or individual templates. Creates idle or disabled
            bots on this desk. Nothing is armed.
          </p>
          <LibraryTree
            folders={tree}
            selectedIds={selectedIds}
            onToggleTemplate={toggleTemplate}
            onToggleFolder={toggleFolder}
          />
          {result?.results ? (
            <ul className="mt-3 space-y-1 text-sm">
              {result.results.map((row) => (
                <li
                  key={row.templateId}
                  className={row.ok ? "text-success" : "text-danger"}
                >
                  {row.skipped
                    ? `Skipped ${row.name}`
                    : row.ok
                      ? `Applied ${row.name}`
                      : `${row.name}: ${row.error}`}
                  {row.notes.length > 0 ? ` — ${row.notes.join(" ")}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <ResultNote result={result} />
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className={secondaryBtn}>
              {result?.results ? "Close" : "Cancel"}
            </button>
            {!result?.results ? (
              <button
                type="button"
                disabled={selected.length === 0 || pending}
                onClick={() => void onApply()}
                className={primaryBtn}
              >
                {pending
                  ? "Applying…"
                  : selected.length > 1
                    ? `Apply ${selected.length}`
                    : "Apply"}
              </button>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}

type PickerItem = {
  templateId: string;
  name: string;
  preview: string;
};

type PickerFolder = {
  id: string;
  name: string;
  items: PickerItem[];
  folders: PickerFolder[];
  sharedByEmail: string | null;
};

function asPickerFolder(folder: AutomationTemplateSet): PickerFolder {
  return {
    id: folder.id,
    name: folder.name,
    items: folder.items.map((item) => ({
      templateId: item.templateId,
      name: item.name,
      preview: item.preview,
    })),
    folders: [],
    sharedByEmail: folder.sharedByEmail,
  };
}

function templatesAsItems(rows: TemplateSummary[]): PickerItem[] {
  return rows.map((row) => ({
    templateId: row.id,
    name: row.name,
    preview: [
      row.preview,
      row.sharedByEmail ? `Shared by ${row.sharedByEmail}` : "",
      row.description ?? "",
    ]
      .filter(Boolean)
      .join(" · "),
  }));
}

function folderTemplateIds(folder: PickerFolder): string[] {
  return [
    ...new Set([
      ...folder.items.map((item) => item.templateId),
      ...folder.folders.flatMap(folderTemplateIds),
    ]),
  ];
}

function libraryTree(
  templates: TemplateSummary[],
  sets: AutomationTemplateSet[],
): PickerFolder[] {
  const scopes = [
    {
      key: "platform",
      label: "Platform",
      match: (row: { visibility: string; sharedByEmail: string | null }) =>
        row.visibility === "platform",
    },
    {
      key: "shared",
      label: "Shared",
      match: (row: { visibility: string; sharedByEmail: string | null }) =>
        Boolean(row.sharedByEmail),
    },
    {
      key: "mine",
      label: "My templates",
      match: (row: { visibility: string; sharedByEmail: string | null }) =>
        row.visibility === "user" && !row.sharedByEmail,
    },
  ] as const;
  return scopes.flatMap((scope) => {
    const nested = sets.filter((folder) => scope.match(folder)).map(asPickerFolder);
    const filed = new Set(
      nested.flatMap((folder) => folder.items.map((item) => item.templateId)),
    );
    const loose = templates.filter(
      (row) => scope.match(row) && !filed.has(row.id),
    );
    if (nested.length === 0 && loose.length === 0) {
      return [];
    }
    return [
      {
        id: `scope-${scope.key}`,
        name: scope.label,
        items: templatesAsItems(loose),
        folders: nested,
        sharedByEmail: null,
      },
    ];
  });
}

function LibraryTree({
  folders,
  selectedIds,
  onToggleTemplate,
  onToggleFolder,
}: {
  folders: PickerFolder[];
  selectedIds: Set<string>;
  onToggleTemplate: (id: string) => void;
  onToggleFolder: (ids: string[]) => void;
}) {
  if (folders.length === 0) {
    return (
      <p className="mt-3 text-sm text-ink-muted">
        None yet. Save a bot as a template from a card.
      </p>
    );
  }
  return (
    <ul className="mt-3 space-y-1">
      {folders.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          nested={false}
          selectedIds={selectedIds}
          onToggleTemplate={onToggleTemplate}
          onToggleFolder={onToggleFolder}
        />
      ))}
    </ul>
  );
}

function FolderNode({
  folder,
  nested,
  selectedIds,
  onToggleTemplate,
  onToggleFolder,
}: {
  folder: PickerFolder;
  nested: boolean;
  selectedIds: Set<string>;
  onToggleTemplate: (id: string) => void;
  onToggleFolder: (ids: string[]) => void;
}) {
  const ids = folderTemplateIds(folder);
  const selectedCount = ids.filter((id) => selectedIds.has(id)).length;
  const hasChildren = folder.folders.length > 0 || folder.items.length > 0;
  return (
    <li
      className={
        nested
          ? undefined
          : "rounded-control border border-line bg-canvas px-3 py-2"
      }
    >
      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={ids.length > 0 && selectedCount === ids.length}
          ref={(node) => {
            if (node) {
              node.indeterminate =
                selectedCount > 0 && selectedCount < ids.length;
            }
          }}
          onChange={() => onToggleFolder(ids)}
        />
        <span>
          <span className="block font-medium">{folder.name}</span>
          <span className="block text-xs text-ink-muted">
            {ids.length === 0
              ? "Empty folder"
              : `${ids.length} template${ids.length === 1 ? "" : "s"}`}
            {folder.sharedByEmail
              ? ` · Shared by ${folder.sharedByEmail}`
              : ""}
          </span>
        </span>
      </label>
      {hasChildren ? (
        <ul className="mt-2 ml-6 space-y-1 border-l border-line pl-3">
          {folder.folders.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              nested
              selectedIds={selectedIds}
              onToggleTemplate={onToggleTemplate}
              onToggleFolder={onToggleFolder}
            />
          ))}
          {folder.items.map((item) => (
            <li key={`${folder.id}-${item.templateId}`}>
              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4"
                  checked={selectedIds.has(item.templateId)}
                  onChange={() => onToggleTemplate(item.templateId)}
                />
                <span>
                  <span className="block">{item.name}</span>
                  <span className="block text-xs text-ink-muted">
                    {item.preview}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function deskTypeLabel(deskType: TemplateDeskType): string {
  return formatDeskType(deskType);
}
