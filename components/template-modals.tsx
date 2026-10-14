"use client";

import { useEffect, useRef, useState } from "react";
import { ModalHost, useModalPortalHost } from "@/components/portal-host";

export { ModalHost, useModalPortalHost };
import { createPortal } from "react-dom";
import { AppMultiSelect } from "@/components/app-select";
import { AppCheck, AppRadio } from "@/components/app-check";
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
import {
  findMatchingLibraryTemplate,
  type TemplateDeskType,
  type TemplateRecipe,
  type TemplateVisibility,
} from "@/lib/templates/recipe";
import { TemplateNameWithParameters } from "@/components/template-parameters-tip";
import { attachedBacktestsByTemplateAction } from "@/lib/backtest/actions";
import type { TemplateBacktestLink } from "@/lib/backtest/model";
import { formatDeskType } from "@/lib/accounts/model";
import {
  BotButtonLead,
  botBtnIcon,
  deskActionBtnClass,
} from "@/components/bot-form-chrome";
import { IconTemplates } from "@/components/icons";
import { useThemePreviewPortalClass } from "@/components/theme-scheme-preview";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";
const primaryBtn =
  "rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent";
const secondaryBtn =
  "rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong";

export function TemplateAudienceFields({
  platform,
  onChange,
}: {
  platform: boolean;
  onChange: (platform: boolean) => void;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="text-sm text-ink">Save as</legend>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        <label className="inline-flex items-center gap-2 text-sm text-ink">
          <AppRadio
            name="templateAudience"
            value="user"
            checked={!platform}
            onChange={() => onChange(false)}
          />
          User template
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-ink">
          <AppRadio
            name="templateAudience"
            value="platform"
            checked={platform}
            onChange={() => onChange(true)}
          />
          Platform template
        </label>
      </div>
    </fieldset>
  );
}

export function StarterPackCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="mt-3 flex items-start gap-2 text-sm text-ink">
      <AppCheck
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      Include in Starter Pack
    </label>
  );
}

const modalStack: number[] = [];
let nextModalId = 0;

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  size,
  sticky,
  elevated = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  size?: "md" | "lg" | "xl";
  sticky?: React.ReactNode;
  elevated?: boolean;
}) {
  const previewClass = useThemePreviewPortalClass();
  const portalHost = useModalPortalHost();
  useEffect(() => {
    const id = ++nextModalId;
    modalStack.push(id);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && modalStack[modalStack.length - 1] === id) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const index = modalStack.lastIndexOf(id);
      if (index >= 0) {
        modalStack.splice(index, 1);
      }
    };
  }, [onClose]);
  if (typeof document === "undefined" || !portalHost) {
    return null;
  }
  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center bg-canvas/70 p-4 ${
        elevated ? "z-[60]" : "z-50"
      } ${previewClass}`.trim()}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[90vh] w-full flex-col rounded-card border border-line bg-surface-raised ${
          sticky ? "overflow-hidden" : "overflow-y-auto p-5"
        } ${
          size === "xl"
            ? "max-w-3xl"
            : size === "lg" || wide
              ? "max-w-2xl"
              : "max-w-lg"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {sticky ? (
          <>
            <div className="shrink-0 border-b border-line px-5 pt-5 pb-4">
              <PanelCloseButton onClick={onClose} />
              <h2 className="pr-8 text-lg font-semibold text-ink">{title}</h2>
              {sticky}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [overflow-anchor:none]">
              {children}
            </div>
          </>
        ) : (
          <>
            <PanelCloseButton onClick={onClose} />
            <h2 className="pr-8 text-lg font-semibold text-ink">{title}</h2>
            {children}
          </>
        )}
      </div>
    </div>,
    portalHost,
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
  library = [],
  currentRecipe = null,
  onSaved,
  buttonClassName,
}: {
  isAdmin: boolean;
  defaultName: string;
  buildForm: () => FormData;
  kind: TemplateDeskType;
  folders?: AutomationTemplateSet[];
  library?: readonly {
    name: string;
    recipe: TemplateRecipe;
    visibility?: string;
  }[];
  currentRecipe?: TemplateRecipe | null;
  onSaved?: (saved: {
    id: string;
    name: string;
    visibility: TemplateVisibility;
  }) => void;
  buttonClassName?: string;
}) {
  const savedUser = findMatchingLibraryTemplate(
    currentRecipe,
    library,
    "user",
  );
  const savedPlatform = findMatchingLibraryTemplate(
    currentRecipe,
    library,
    "platform",
  );
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<TemplateActionResult | null>(null);
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState(false);
  const [replace, setReplace] = useState(false);
  const [folderIds, setFolderIds] = useState<string[]>([]);
  const [createFolder, setCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [starterPack, setStarterPack] = useState(false);

  const folderGroups = saveFolderGroups(folders, kind, platform);

  function resetAndOpen() {
    setName(defaultName);
    setDescription("");
    setPlatform(false);
    setReplace(false);
    setFolderIds([]);
    setCreateFolder(false);
    setNewFolderName("");
    setStarterPack(false);
    setResult(null);
    setOpen(true);
  }

  function chooseAudience(next: boolean) {
    setPlatform(next);
    setFolderIds([]);
    setCreateFolder(false);
    setNewFolderName("");
    if (!next) {
      setStarterPack(false);
    }
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
        onSaved?.({
          id: next.templateId,
          name,
          visibility: platform ? "platform" : "user",
        });
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
        onClick={() => resetAndOpen()}
        className={
          buttonClassName ??
          "inline-flex shrink-0 items-center gap-1.5 rounded-control px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink"
        }
      >
        <BotButtonLead icon={<IconTemplates {...botBtnIcon} />}>
          {savedUser
            ? `Saved template: ${savedUser.name}`
            : "Save as template"}
        </BotButtonLead>
      </button>
      {open ? (
        <Modal
          title="Save as template"
          onClose={() => setOpen(false)}
        >
          <p className="mt-1 text-sm text-ink-muted">
            {platform
              ? "Visible to every member. Confirm the name before publishing."
              : "Saved to your template library. Apply it later on any matching desk."}
          </p>
          {isAdmin ? (
            <TemplateAudienceFields platform={platform} onChange={chooseAudience} />
          ) : null}
          {platform && savedPlatform ? (
            <p className="mt-2 text-sm text-ink-muted">
              Already saved as {savedPlatform.name}.
            </p>
          ) : null}
          <label className="mt-4 block text-sm text-ink">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              className={fieldClass}
            />
          </label>
          <label className="mt-3 block text-sm text-ink">
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
            <p className="text-sm text-ink">Add to folder</p>
            {folderGroups.length === 0 ? (
              <p className="mt-1 text-sm text-ink-faint">
                {platform
                  ? "None yet. Create one below."
                  : "None yet. Create one below or on My Folders."}
              </p>
            ) : (
              <AppMultiSelect
                className="mt-1"
                value={folderIds}
                onChange={setFolderIds}
                placeholder="Folders"
                options={folderGroups.flatMap((group) =>
                  group.rows.map((row) => ({
                    value: row.id,
                    label:
                      folderGroups.length > 1
                        ? `${row.name} · ${group.label}`
                        : row.name,
                  })),
                )}
              />
            )}
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm text-ink">
            <AppCheck
              checked={createFolder}
              onChange={(event) => setCreateFolder(event.target.checked)}
            />
            {platform ? "Create a new platform folder" : "Create a new folder"}
          </label>
          {createFolder ? (
            <label className="mt-2 block text-sm text-ink">
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
              <AppCheck
                checked={replace}
                onChange={(event) => setReplace(event.target.checked)}
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

export function saveFolderGroups(
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
  const [tab, setTab] = useState<PickerTab>("mine");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<TemplateActionResult | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [backtestsByTemplate, setBacktestsByTemplate] = useState<
    Record<string, TemplateBacktestLink[]> | null
  >(null);
  const selected = templates.filter((row) => selectedIds.has(row.id));
  const templateKey = templates
    .filter((row) => row.deskType === deskType)
    .map((row) => row.id)
    .join(",");

  useEffect(() => {
    if (!open) {
      return;
    }
    const ids = templateKey ? templateKey.split(",") : [];
    let cancelled = false;
    void attachedBacktestsByTemplateAction(ids).then((rows) => {
      if (!cancelled) {
        setBacktestsByTemplate(rows);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, templateKey]);
  const tree = libraryTree(
    templates.filter((row) => row.deskType === deskType),
    sets.filter((row) => row.deskType === deskType),
  );

  function selectTab(next: PickerTab) {
    setTab(next);
    panelRef.current?.parentElement?.scrollTo({ top: 0 });
  }

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
      <button
        type="button"
        onClick={() => {
          setTab("mine");
          setOpen(true);
        }}
        className={deskActionBtnClass}
      >
        <BotButtonLead icon={<IconTemplates {...botBtnIcon} />}>
          Create Bot from Template
        </BotButtonLead>
      </button>
      {open ? (
        <Modal
          title="Create Bot from Template"
          onClose={() => setOpen(false)}
          wide
          sticky={
            <>
              <div className="mt-1 flex items-start justify-between gap-4">
                <p className="min-w-0 max-w-sm text-sm text-ink-muted">
                  Tick a folder or individual templates. Creates idle or
                  disabled bots on this desk. Nothing is armed.
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className={secondaryBtn}
                  >
                    {result?.results?.length ? "Close" : "Cancel"}
                  </button>
                  {!result?.results?.length ? (
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
              </div>
              {result?.results && result.results.length > 0 ? (
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
            </>
          }
        >
          <div ref={panelRef}>
            <nav
              role="tablist"
              aria-label="Template source"
              className="sticky top-0 z-10 -mx-5 -mt-4 mb-6 flex border-b border-line bg-surface-raised px-5"
            >
              <PickerTabButton
                selected={tab === "mine"}
                controls="template-picker-mine"
                onClick={() => selectTab("mine")}
              >
                My Templates
              </PickerTabButton>
              <PickerTabButton
                selected={tab === "platform"}
                controls="template-picker-platform"
                onClick={() => selectTab("platform")}
              >
                Platform Templates
              </PickerTabButton>
            </nav>
            <ScopePanel
              id={tab === "mine" ? "template-picker-mine" : "template-picker-platform"}
              scope={tab === "mine" ? tree.mine : tree.platform}
              backtestsByTemplate={backtestsByTemplate}
              empty={
                tab === "mine"
                  ? "None yet. Save a bot as a template from a card."
                  : "No platform templates for this desk."
              }
              selectedIds={selectedIds}
              onToggleTemplate={toggleTemplate}
              onToggleFolder={toggleFolder}
            />
          </div>
        </Modal>
      ) : null}
    </>
  );
}

type PickerTab = "mine" | "platform";

type PickerItem = {
  templateId: string;
  name: string;
  description: string | null;
  recipe: TemplateRecipe | null;
};

type PickerScope = {
  folders: PickerFolder[];
  loose: PickerItem[];
};

type PickerFolder = {
  id: string;
  name: string;
  items: PickerItem[];
  folders: PickerFolder[];
  sharedByEmail: string | null;
};

function asPickerFolder(
  folder: AutomationTemplateSet,
  recipes: Map<string, TemplateRecipe>,
  descriptions: Map<string, string | null>,
): PickerFolder {
  return {
    id: folder.id,
    name: folder.name,
    items: folder.items.map((item) => ({
      templateId: item.templateId,
      name: item.name,
      description: descriptions.get(item.templateId) ?? null,
      recipe: recipes.get(item.templateId) ?? null,
    })),
    folders: [],
    sharedByEmail: folder.sharedByEmail,
  };
}

function templatesAsItems(rows: TemplateSummary[]): PickerItem[] {
  return rows.map((row) => ({
    templateId: row.id,
    name: row.name,
    description: row.description,
    recipe: row.recipe,
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

function scopeContent(
  templates: TemplateSummary[],
  sets: AutomationTemplateSet[],
  recipes: Map<string, TemplateRecipe>,
  descriptions: Map<string, string | null>,
  match: (row: { visibility: string; sharedByEmail: string | null }) => boolean,
): PickerScope {
  const folders = sets
    .filter((folder) => match(folder))
    .map((folder) => asPickerFolder(folder, recipes, descriptions));
  const filed = new Set(
    folders.flatMap((folder) => folder.items.map((item) => item.templateId)),
  );
  return {
    folders,
    loose: templatesAsItems(
      templates.filter((row) => match(row) && !filed.has(row.id)),
    ),
  };
}

function libraryTree(
  templates: TemplateSummary[],
  sets: AutomationTemplateSet[],
): { mine: PickerScope; platform: PickerScope } {
  const recipes = new Map(templates.map((row) => [row.id, row.recipe]));
  const descriptions = new Map(
    templates.map((row) => [row.id, row.description]),
  );
  const mine = scopeContent(
    templates,
    sets,
    recipes,
    descriptions,
    (row) => row.visibility === "user" && !row.sharedByEmail,
  );
  const shared = scopeContent(templates, sets, recipes, descriptions, (row) =>
    Boolean(row.sharedByEmail),
  );
  return {
    mine: {
      folders: [...mine.folders, ...shared.folders],
      loose: [...mine.loose, ...shared.loose],
    },
    platform: scopeContent(
      templates,
      sets,
      recipes,
      descriptions,
      (row) => row.visibility === "platform",
    ),
  };
}

function PickerTabButton({
  selected,
  controls,
  onClick,
  children,
}: {
  selected: boolean;
  controls: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={controls}
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        selected
          ? "border-accent text-ink"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function templateBacktests(
  map: Record<string, TemplateBacktestLink[]> | null,
  templateId: string,
): TemplateBacktestLink[] | null {
  if (!map) {
    return null;
  }
  return map[templateId] ?? [];
}

function ScopePanel({
  id,
  scope,
  backtestsByTemplate,
  empty,
  selectedIds,
  onToggleTemplate,
  onToggleFolder,
}: {
  id: string;
  scope: PickerScope;
  backtestsByTemplate: Record<string, TemplateBacktestLink[]> | null;
  empty: string;
  selectedIds: Set<string>;
  onToggleTemplate: (id: string) => void;
  onToggleFolder: (ids: string[]) => void;
}) {
  const emptyList = scope.folders.length === 0 && scope.loose.length === 0;
  return (
    <div
      id={id}
      role="tabpanel"
      className="min-h-[30rem] max-h-[30rem] overflow-y-auto rounded-control border border-line bg-canvas px-3 py-2"
    >
      {emptyList ? (
        <p className="text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {scope.folders.map((folder) => (
            <FolderNode
              key={folder.id}
              folder={folder}
              nested
              backtestsByTemplate={backtestsByTemplate}
              selectedIds={selectedIds}
              onToggleTemplate={onToggleTemplate}
              onToggleFolder={onToggleFolder}
            />
          ))}
          {scope.loose.map((item) => (
            <TemplatePick
              key={item.templateId}
              item={item}
              backtests={templateBacktests(
                backtestsByTemplate,
                item.templateId,
              )}
              selectedIds={selectedIds}
              onToggleTemplate={onToggleTemplate}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TemplatePick({
  item,
  backtests,
  selectedIds,
  onToggleTemplate,
}: {
  item: PickerItem;
  backtests: TemplateBacktestLink[] | null;
  selectedIds: Set<string>;
  onToggleTemplate: (id: string) => void;
}) {
  return (
    <li>
      <label className="flex items-center gap-2 text-sm text-ink">
        <AppCheck
          checked={selectedIds.has(item.templateId)}
          onChange={() => onToggleTemplate(item.templateId)}
        />
        <span className="min-w-0">
          <TemplateNameWithParameters
            name={item.name}
            description={item.description}
            recipe={item.recipe}
            templateId={item.templateId}
            backtests={backtests}
          />
        </span>
      </label>
    </li>
  );
}

function FolderNode({
  folder,
  nested,
  backtestsByTemplate,
  selectedIds,
  onToggleTemplate,
  onToggleFolder,
}: {
  folder: PickerFolder;
  nested: boolean;
  backtestsByTemplate: Record<string, TemplateBacktestLink[]> | null;
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
      <label className="flex items-center gap-2 text-sm text-ink">
        <AppCheck
          checked={ids.length > 0 && selectedCount === ids.length}
          indeterminate={selectedCount > 0 && selectedCount < ids.length}
          onChange={() => onToggleFolder(ids)}
        />
        <span className="min-w-0">
          <span className="font-medium">{folder.name}</span>
          <span> ({ids.length})</span>
          {folder.sharedByEmail ? (
            <span className="text-ink-muted">
              {" "}
              · Shared by {folder.sharedByEmail}
            </span>
          ) : null}
        </span>
      </label>
      {hasChildren ? (
        <ul className="mt-1 ml-6 space-y-1 border-l border-line pl-3">
          {folder.folders.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              nested
              backtestsByTemplate={backtestsByTemplate}
              selectedIds={selectedIds}
              onToggleTemplate={onToggleTemplate}
              onToggleFolder={onToggleFolder}
            />
          ))}
          {folder.items.map((item) => (
            <TemplatePick
              key={`${folder.id}-${item.templateId}`}
              item={item}
              backtests={templateBacktests(
                backtestsByTemplate,
                item.templateId,
              )}
              selectedIds={selectedIds}
              onToggleTemplate={onToggleTemplate}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function deskTypeLabel(deskType: TemplateDeskType): string {
  return formatDeskType(deskType);
}
