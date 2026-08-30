"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BacktestHighlightHover } from "@/components/backtest-highlight-hover";
import { LocalTime } from "@/components/local-time";
import { PageHeading } from "@/components/page-heading";
import { Modal, StarterPackCheckbox } from "@/components/template-modals";
import type { BacktestLinkHighlight } from "@/lib/backtest/model";
import { formatTemplateDeskType } from "@/lib/templates/recipe";
import {
  createTemplateSetAction,
  deleteTemplateAction,
  deleteTemplateSetAction,
  exportTemplateLibraryAction,
  importTemplateLibraryAction,
  importSharedSetAction,
  importSharedTemplateAction,
  bulkLibraryAction,
  publishTemplateCopyAction,
  shareSetAction,
  shareTemplateAction,
  unshareSetAction,
  unshareTemplateAction,
  updateTemplateMetaAction,
  updateTemplateSetAction,
  type TemplateActionResult,
} from "@/lib/templates/actions";
import type { LibraryTab } from "@/lib/templates/library-tab";
import type { TemplateDeskType } from "@/lib/templates/recipe";
import { recipePreview } from "@/lib/templates/recipe";
import type {
  AutomationTemplate,
  AutomationTemplateSet,
} from "@/lib/templates/store";
import {
  parseTemplateLibraryJson,
  type TemplateLibraryFile,
} from "@/lib/templates/transfer";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";
const primaryBtn =
  "rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink hover:bg-accent";
const secondaryBtn =
  "rounded-control border border-line px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink";
const dangerBtn =
  "rounded-control border border-line px-3 py-1.5 text-xs text-danger hover:bg-danger/10";
const actionLink =
  "rounded-control border border-line px-2 py-0.5 text-xs font-medium text-accent hover:text-accent-strong";

function tabForVariant(
  tab: LibraryTab,
  variant: "account" | "admin",
): LibraryTab {
  if (
    variant === "admin" &&
    (tab === "shared-templates" || tab === "shared-sets")
  ) {
    return "templates";
  }
  return tab;
}

type SortKey =
  | "name"
  | "deskType"
  | "owner"
  | "folder"
  | "shared"
  | "updated"
  | "items"
  | "starter";

type SortState = { key: SortKey; dir: "asc" | "desc" };

function foldersHolding(
  templateId: string,
  folders: AutomationTemplateSet[],
): AutomationTemplateSet[] {
  return folders.filter((folder) =>
    folder.items.some((item) => item.templateId === templateId),
  );
}

function templateShowsStarterPack(
  template: { id: string; starterPack: boolean },
  folders: AutomationTemplateSet[],
): boolean {
  return (
    template.starterPack ||
    foldersHolding(template.id, folders).some((folder) => folder.starterPack)
  );
}

function folderLabel(folders: AutomationTemplateSet[]): string {
  if (folders.length === 0) {
    return "—";
  }
  return folders.map((folder) => folder.name).join(", ");
}

function sharedCountLabel(peers: { email: string }[]): string {
  return peers.length === 0 ? "—" : String(peers.length);
}

function sharedLabel(
  peers: { email: string }[],
  sharedBy?: string | null,
): string {
  if (sharedBy) {
    return sharedBy;
  }
  if (peers.length === 0) {
    return "—";
  }
  return peers.map((peer) => peer.email).join(", ");
}

function StarterPackMark({ on }: { on: boolean }) {
  if (!on) {
    return <span className="text-ink-muted">—</span>;
  }
  return (
    <span className="inline-flex text-success" title="Included in Starter Pack">
      <svg
        viewBox="0 0 16 16"
        fill="none"
        aria-label="Included in Starter Pack"
        className="size-4"
      >
        <path
          d="M3.5 8.5 6.5 11.5 12.5 4.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function compareText(a: string, b: string, dir: "asc" | "desc"): number {
  const n = a.localeCompare(b, undefined, { sensitivity: "base" });
  return dir === "asc" ? n : -n;
}

function compareNum(a: number, b: number, dir: "asc" | "desc"): number {
  const n = a === b ? 0 : a < b ? -1 : 1;
  return dir === "asc" ? n : -n;
}

function assignableFolders(
  template: AutomationTemplate,
  folders: AutomationTemplateSet[],
  variant: "account" | "admin",
): AutomationTemplateSet[] {
  return folders.filter((folder) => {
    if (folder.deskType !== template.deskType || folder.sharedByEmail) {
      return false;
    }
    if (variant === "admin") {
      return folder.visibility === "platform";
    }
    if (variant === "account" && folder.visibility === "platform") {
      return false;
    }
    if (template.visibility === "platform") {
      return folder.visibility === "platform" || folder.visibility === "user";
    }
    return (
      folder.visibility === "user" && folder.userId === template.userId
    );
  });
}

function foldersForAll(
  templates: AutomationTemplate[],
  folders: AutomationTemplateSet[],
  variant: "account" | "admin",
): AutomationTemplateSet[] {
  if (templates.length === 0) {
    return [];
  }
  return folders.filter((folder) =>
    templates.every(
      (template) => assignableFolders(template, [folder], variant).length > 0,
    ),
  );
}

export function TemplatesLibrary({
  variant,
  title,
  description,
  overline,
  templates,
  sets,
  sharedTemplates = [],
  sharedSets = [],
  linkedBacktests = {},
  initialTab = "templates",
}: {
  variant: "account" | "admin";
  title: string;
  description: string;
  overline?: string;
  templates: AutomationTemplate[];
  sets: AutomationTemplateSet[];
  sharedTemplates?: AutomationTemplate[];
  sharedSets?: AutomationTemplateSet[];
  linkedBacktests?: Record<string, BacktestLinkHighlight>;
  initialTab?: LibraryTab;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<LibraryTab>(tabForVariant(initialTab, variant));
  const [deskFilter, setDeskFilter] = useState<"all" | TemplateDeskType>("all");
  const [folderFilter, setFolderFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "updated", dir: "desc" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [sharingTemplateId, setSharingTemplateId] = useState<string | null>(null);
  const [sharingFolderId, setSharingFolderId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkFolderOpen, setBulkFolderOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setTab(tabForVariant(initialTab, variant));
  }, [initialTab, variant]);

  const knownFolders = useMemo(() => {
    const byId = new Map<string, AutomationTemplateSet>();
    for (const folder of [...sets, ...sharedSets]) {
      byId.set(folder.id, folder);
    }
    return [...byId.values()];
  }, [sets, sharedSets]);

  const needle = query.trim().toLowerCase();

  const filteredTemplates = templates.filter((row) => {
    if (variant === "account" && row.visibility === "platform") {
      return false;
    }
    if (variant === "admin" && row.visibility !== "platform") {
      return false;
    }
    if (deskFilter !== "all" && row.deskType !== deskFilter) {
      return false;
    }
    return true;
  });
  const filteredSets = sets.filter((row) => {
    if (variant === "account" && row.visibility === "platform") {
      return false;
    }
    if (variant === "admin" && row.visibility !== "platform") {
      return false;
    }
    if (deskFilter !== "all" && row.deskType !== deskFilter) {
      return false;
    }
    return true;
  });
  const filteredSharedTemplates = sharedTemplates.filter(
    (row) => deskFilter === "all" || row.deskType === deskFilter,
  );
  const filteredSharedSets = sharedSets.filter(
    (row) => deskFilter === "all" || row.deskType === deskFilter,
  );

  const listedTemplates = useMemo(() => {
    const rows = (
      tab === "shared-templates" ? filteredSharedTemplates : filteredTemplates
    ).filter((row) => {
      const held = foldersHolding(row.id, knownFolders);
      if (folderFilter !== "all" && !held.some((folder) => folder.id === folderFilter)) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const hay = [
        row.name,
        row.description ?? "",
        row.ownerEmail ?? "",
        row.sharedByEmail ?? "",
        formatTemplateDeskType(row.deskType),
        folderLabel(held),
        sharedLabel(row.sharedWith, row.sharedByEmail),
        templateShowsStarterPack(row, knownFolders) ? "starter pack" : "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
    return [...rows].sort((a, b) => {
      if (sort.key === "name") {
        return compareText(a.name, b.name, sort.dir);
      }
      if (sort.key === "deskType") {
        return compareText(a.deskType, b.deskType, sort.dir);
      }
      if (sort.key === "owner") {
        return compareText(a.ownerEmail ?? "", b.ownerEmail ?? "", sort.dir);
      }
      if (sort.key === "folder") {
        return compareText(
          folderLabel(foldersHolding(a.id, knownFolders)),
          folderLabel(foldersHolding(b.id, knownFolders)),
          sort.dir,
        );
      }
      if (sort.key === "shared") {
        if (a.sharedByEmail || b.sharedByEmail) {
          return compareText(
            sharedLabel(a.sharedWith, a.sharedByEmail),
            sharedLabel(b.sharedWith, b.sharedByEmail),
            sort.dir,
          );
        }
        return compareNum(a.sharedWith.length, b.sharedWith.length, sort.dir);
      }
      if (sort.key === "starter") {
        return compareNum(
          Number(templateShowsStarterPack(a, knownFolders)),
          Number(templateShowsStarterPack(b, knownFolders)),
          sort.dir,
        );
      }
      return compareNum(a.updatedAtMs, b.updatedAtMs, sort.dir);
    });
  }, [
    tab,
    filteredTemplates,
    filteredSharedTemplates,
    folderFilter,
    needle,
    sort,
    knownFolders,
  ]);

  const listedFolders = useMemo(() => {
    const rows = (tab === "shared-sets" ? filteredSharedSets : filteredSets).filter(
      (row) => {
        if (!needle) {
          return true;
        }
        const hay = [
          row.name,
          row.description ?? "",
          row.ownerEmail ?? "",
          row.sharedByEmail ?? "",
          formatTemplateDeskType(row.deskType),
          row.items.map((item) => item.name).join(" "),
          sharedLabel(row.sharedWith, row.sharedByEmail),
          row.starterPack ? "starter pack" : "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      },
    );
    return [...rows].sort((a, b) => {
      if (sort.key === "name") {
        return compareText(a.name, b.name, sort.dir);
      }
      if (sort.key === "deskType") {
        return compareText(a.deskType, b.deskType, sort.dir);
      }
      if (sort.key === "owner") {
        return compareText(a.ownerEmail ?? "", b.ownerEmail ?? "", sort.dir);
      }
      if (sort.key === "items") {
        return compareNum(a.items.length, b.items.length, sort.dir);
      }
      if (sort.key === "shared") {
        if (a.sharedByEmail || b.sharedByEmail) {
          return compareText(
            sharedLabel(a.sharedWith, a.sharedByEmail),
            sharedLabel(b.sharedWith, b.sharedByEmail),
            sort.dir,
          );
        }
        return compareNum(a.sharedWith.length, b.sharedWith.length, sort.dir);
      }
      if (sort.key === "starter") {
        return compareNum(Number(a.starterPack), Number(b.starterPack), sort.dir);
      }
      return compareNum(a.updatedAtMs, b.updatedAtMs, sort.dir);
    });
  }, [tab, filteredSets, filteredSharedSets, needle, sort]);

  const folderFilterOptions = (
    tab === "shared-templates" ? sharedSets : sets
  ).filter((row) => {
    if (deskFilter !== "all" && row.deskType !== deskFilter) {
      return false;
    }
    if (variant === "account" && tab === "templates" && row.visibility === "platform") {
      return false;
    }
    if (variant === "admin" && row.visibility !== "platform") {
      return false;
    }
    return true;
  });

  const editingTemplate =
    templates.find((row) => row.id === editingTemplateId) ??
    sharedTemplates.find((row) => row.id === editingTemplateId) ??
    null;
  const editingFolder =
    sets.find((row) => row.id === editingFolderId) ??
    sharedSets.find((row) => row.id === editingFolderId) ??
    null;
  const sharingTemplate =
    templates.find((row) => row.id === sharingTemplateId) ?? null;
  const sharingFolder = sets.find((row) => row.id === sharingFolderId) ?? null;

  const sharedTab = tab.startsWith("shared");
  const showOwner = sharedTab;
  const showSharedWith = variant === "account" && !sharedTab;
  const templateTab = tab === "templates" || tab === "shared-templates";
  const listedIds = templateTab
    ? listedTemplates.map((row) => row.id)
    : listedFolders.map((row) => row.id);
  const selectedCount = listedIds.filter((id) => selected.has(id)).length;
  const allListedSelected =
    listedIds.length > 0 && listedIds.every((id) => selected.has(id));
  const selectedTemplates = templates.filter(
    (row) => selected.has(row.id) && listedIds.includes(row.id),
  );
  const bulkFolders = foldersForAll(selectedTemplates, sets, variant);
  const showStarterPack = variant === "admin";
  const tableColumns =
    5 +
    (sharedTab ? 0 : 1) +
    (showOwner ? 1 : 0) +
    (showSharedWith ? 1 : 0) +
    (showStarterPack ? 1 : 0);

  function flash(result: TemplateActionResult) {
    if (result.json && result.filename) {
      downloadJson(result.json, result.filename);
    }
    if (result.ok) {
      setError(null);
      setMessage(
        result.notes?.join(" ") || (result.json ? "Downloaded." : "Saved."),
      );
    } else {
      setMessage(null);
      setError(result.error ?? "That did not work.");
    }
  }

  function onSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "updated" ? "desc" : "asc" },
    );
  }

  function onEditSaved(result: TemplateActionResult) {
    flash(result);
    if (result.ok) {
      setEditingTemplateId(null);
      setEditingFolderId(null);
      router.refresh();
    }
  }

  async function deleteTemplateRow(row: AutomationTemplate) {
    if (!window.confirm(`Delete “${row.name}”? This cannot be undone.`)) {
      return;
    }
    const data = new FormData();
    data.set("templateId", row.id);
    const result = await deleteTemplateAction(data);
    flash(result);
    if (result.ok) {
      setSelected((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
      router.refresh();
    }
  }

  async function deleteFolderRow(row: AutomationTemplateSet) {
    if (!window.confirm(`Delete folder “${row.name}”? This cannot be undone.`)) {
      return;
    }
    const data = new FormData();
    data.set("setId", row.id);
    const result = await deleteTemplateSetAction(data);
    flash(result);
    if (result.ok) {
      setSelected((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
      router.refresh();
    }
  }

  function changeTab(next: LibraryTab) {
    setTab(next);
    setSelected(new Set());
    setBulkFolderOpen(false);
    setCreatingFolder(false);
    const params = new URLSearchParams(window.location.search);
    if (next === "templates") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function toggleRow(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAllListed() {
    setSelected((current) => {
      const next = new Set(current);
      if (allListedSelected) {
        for (const id of listedIds) {
          next.delete(id);
        }
      } else {
        for (const id of listedIds) {
          next.add(id);
        }
      }
      return next;
    });
  }

  async function runBulk(op: "publish" | "unpublish" | "delete") {
    const ids = listedIds.filter((id) => selected.has(id));
    if (ids.length === 0) {
      return;
    }
    const noun = templateTab ? "template" : "folder";
    const plural = ids.length === 1 ? noun : `${noun}s`;
    if (
      op === "delete" &&
      !window.confirm(`Delete ${ids.length} ${plural}? This cannot be undone.`)
    ) {
      return;
    }
    if (
      op === "unpublish" &&
      !window.confirm(
        `Unpublish ${ids.length} platform ${plural}? Members will no longer see them. User copies stay.`,
      )
    ) {
      return;
    }
    if (
      op === "publish" &&
      !window.confirm(
        `Publish ${ids.length} ${plural} as platform copies? User rows stay.`,
      )
    ) {
      return;
    }
    const data = new FormData();
    data.set("kind", templateTab ? "template" : "folder");
    data.set("op", op);
    data.set("ids", ids.join(","));
    const result = await bulkLibraryAction(data);
    flash(result);
    if (result.ok) {
      setSelected(new Set());
    }
  }

  function openBulkFolder() {
    const types = new Set(selectedTemplates.map((row) => row.deskType));
    if (types.size !== 1) {
      flash({ ok: false, error: "Select templates of one desk type." });
      return;
    }
    setBulkFolderOpen(true);
  }

  async function exportSelected() {
    const ids = listedIds.filter((id) => selected.has(id));
    if (ids.length === 0) {
      return;
    }
    const data = new FormData();
    data.set("scope", variant === "admin" ? "platform" : "own");
    data.set("kind", templateTab ? "template" : "folder");
    data.set("ids", ids.join(","));
    flash(await exportTemplateLibraryAction(data));
  }

  async function exportAll() {
    const data = new FormData();
    data.set("scope", variant === "admin" ? "platform" : "own");
    flash(await exportTemplateLibraryAction(data));
  }

  return (
    <div>
      <PageHeading
        overline={overline}
        title={title}
        className="mb-2"
        actions={
          <>
            <button
              type="button"
              onClick={() => void exportAll()}
              className={secondaryBtn}
            >
              Export all
            </button>
            <button
              type="button"
              onClick={() => setImporting(true)}
              className={secondaryBtn}
            >
              Import
            </button>
          </>
        }
      />
      <p className="mb-6 text-sm text-ink-muted">{description}</p>
      <nav className="flex flex-wrap border-b border-line">
        <TabButton selected={tab === "templates"} onClick={() => changeTab("templates")}>
          {variant === "admin" ? "Templates" : "My Templates"}
        </TabButton>
        <TabButton selected={tab === "sets"} onClick={() => changeTab("sets")}>
          {variant === "admin" ? "Folders" : "My Folders"}
        </TabButton>
        {variant === "account" ? (
          <>
            <TabButton
              selected={tab === "shared-templates"}
              onClick={() => changeTab("shared-templates")}
            >
              Shared Templates
            </TabButton>
            <TabButton
              selected={tab === "shared-sets"}
              onClick={() => changeTab("shared-sets")}
            >
              Shared Folders
            </TabButton>
          </>
        ) : null}
      </nav>
      {tab === "sets" ? (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setCreatingFolder(true)}
            className={primaryBtn}
          >
            Add New Folder
          </button>
        </div>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs text-ink-muted">
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-xs text-ink-muted">
          Desk type
          <select
            value={deskFilter}
            onChange={(event) =>
              setDeskFilter(event.target.value as "all" | TemplateDeskType)
            }
            className={fieldClass}
          >
            <option value="all">All desk types</option>
            <option value="dca">DCA</option>
            <option value="perps">Perps bots</option>
            <option value="cash_and_carry">Cash and Carry</option>
          </select>
        </label>
        {tab === "templates" || tab === "shared-templates" ? (
          <label className="block text-xs text-ink-muted">
            Folder
            <select
              value={folderFilter}
              onChange={(event) => setFolderFilter(event.target.value)}
              className={fieldClass}
            >
              <option value="all">All folders</option>
              {folderFilterOptions.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}

      {!sharedTab && selectedCount > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <p className="text-sm text-ink-muted">{selectedCount} selected</p>
          {tab === "templates" ? (
            <button type="button" onClick={openBulkFolder} className={secondaryBtn}>
              Add to folder
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void exportSelected()}
            className={secondaryBtn}
          >
            Export
          </button>
          {variant === "admin" ? (
            <button
              type="button"
              onClick={() => void runBulk("unpublish")}
              className={secondaryBtn}
            >
              Unpublish
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void runBulk("delete")}
            className={dangerBtn}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className={secondaryBtn}
          >
            Clear
          </button>
        </div>
      ) : null}

      {tab === "templates" || tab === "shared-templates" ? (
        <LibraryTable
          empty={
            tab === "templates"
              ? variant === "account"
                ? "No templates yet. Open Automations on a DCA, Perps, or Cash and Carry desk and use Save as template."
                : "No platform templates yet. Save as a platform template from Automations."
              : "Nothing shared with you yet. Another member can share a template, or a folder that contains templates, by entering your email."
          }
          rows={listedTemplates.length}
          columns={tableColumns}
        >
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              {sharedTab ? null : (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allListedSelected}
                    onChange={toggleAllListed}
                    aria-label="Select all templates"
                    className="size-4"
                  />
                </th>
              )}
              <SortTh label="Name" k="name" sort={sort} onSort={onSort} />
              <SortTh label="Desk Type" k="deskType" sort={sort} onSort={onSort} />
              {showOwner ? (
                <SortTh
                  label={sharedTab ? "Shared by" : "Owner"}
                  k={sharedTab ? "shared" : "owner"}
                  sort={sort}
                  onSort={onSort}
                />
              ) : null}
              <SortTh label="Folder" k="folder" sort={sort} onSort={onSort} />
              {showSharedWith ? (
                <SortTh label="Shared with" k="shared" sort={sort} onSort={onSort} />
              ) : null}
              {showStarterPack ? (
                <SortTh label="Starter Pack" k="starter" sort={sort} onSort={onSort} />
              ) : null}
              <SortTh label="Updated" k="updated" sort={sort} onSort={onSort} />
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listedTemplates.map((row) => {
              const canEdit =
                !sharedTab &&
                (variant === "admin" || row.visibility === "user");
              const linkedRun = linkedBacktests[row.id];
              return (
                <tr key={row.id} className="border-b border-line last:border-b-0">
                  {sharedTab ? null : (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select ${row.name}`}
                        className="size-4"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-ink">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {row.name}
                      {linkedRun ? (
                        <BacktestHighlightHover highlight={linkedRun}>
                          <Link
                            href={`/account/backtests/${linkedRun.runId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-control bg-success/15 px-1.5 py-0.5 text-[11px] font-medium text-success hover:bg-success/25"
                          >
                            Backtested
                          </Link>
                        </BacktestHighlightHover>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {formatTemplateDeskType(row.deskType)}
                  </td>
                  {showOwner ? (
                    <td className="px-4 py-3 text-ink-muted">
                      {sharedTab
                        ? (row.sharedByEmail ?? "—")
                        : (row.ownerEmail ?? "—")}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-ink-muted">
                    {folderLabel(foldersHolding(row.id, knownFolders))}
                  </td>
                  {showSharedWith ? (
                    <td className="px-4 py-3 tabular-nums text-ink-muted">
                      {sharedCountLabel(row.sharedWith)}
                    </td>
                  ) : null}
                  {showStarterPack ? (
                    <td className="px-4 py-3">
                      <StarterPackMark
                        on={templateShowsStarterPack(row, knownFolders)}
                      />
                    </td>
                  ) : null}
                  <td className="px-4 py-3 tabular-nums text-ink-muted">
                    <LocalTime at={row.updatedAtMs} mode="date" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-3">
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => setEditingTemplateId(row.id)}
                          className={actionLink}
                        >
                          Edit
                        </button>
                      ) : null}
                      {!sharedTab && row.visibility === "user" ? (
                        <button
                          type="button"
                          onClick={() => setSharingTemplateId(row.id)}
                          className={actionLink}
                        >
                          Share
                        </button>
                      ) : null}
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => void deleteTemplateRow(row)}
                          className="rounded-control border border-line px-2 py-0.5 text-xs font-medium text-danger hover:bg-danger/10"
                        >
                          Delete
                        </button>
                      ) : null}
                      {sharedTab ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const data = new FormData();
                              data.set("templateId", row.id);
                              void importSharedTemplateAction(data).then(
                                (result) => {
                                  flash(result);
                                  if (result.ok) {
                                    router.refresh();
                                  }
                                },
                              );
                            }}
                            className={actionLink}
                          >
                            Import
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const data = new FormData();
                              data.set("templateId", row.id);
                              void unshareTemplateAction(data).then((result) => {
                                flash(result);
                                if (result.ok) {
                                  router.refresh();
                                }
                              });
                            }}
                            className="rounded-control border border-line px-2 py-0.5 text-xs font-medium text-danger hover:bg-danger/10"
                          >
                            Remove
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </LibraryTable>
      ) : null}

      {tab === "sets" || tab === "shared-sets" ? (
        <>
          <LibraryTable
            empty={
              tab === "sets"
                ? variant === "admin"
                  ? "No platform folders yet. Use Add New Folder to create one from platform templates of the same desk type."
                  : "No folders yet. Use Add New Folder to create one. Templates are optional."
                : "Nothing shared with you yet. Another member can share a folder by entering your email."
            }
            rows={listedFolders.length}
            columns={tableColumns}
          >
            <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
              <tr>
                {sharedTab ? null : (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allListedSelected}
                      onChange={toggleAllListed}
                      aria-label="Select all folders"
                      className="size-4"
                    />
                  </th>
                )}
                <SortTh label="Name" k="name" sort={sort} onSort={onSort} />
                <SortTh label="Desk Type" k="deskType" sort={sort} onSort={onSort} />
                {showOwner ? (
                  <SortTh
                    label={sharedTab ? "Shared by" : "Owner"}
                    k={sharedTab ? "shared" : "owner"}
                    sort={sort}
                    onSort={onSort}
                  />
                ) : null}
                <SortTh label="Templates" k="items" sort={sort} onSort={onSort} />
                {showSharedWith ? (
                  <SortTh label="Shared with" k="shared" sort={sort} onSort={onSort} />
                ) : null}
                {showStarterPack ? (
                  <SortTh label="Starter Pack" k="starter" sort={sort} onSort={onSort} />
                ) : null}
                <SortTh label="Updated" k="updated" sort={sort} onSort={onSort} />
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {listedFolders.map((row) => {
                const canEdit =
                  !sharedTab &&
                  (variant === "admin" || row.visibility === "user");
                return (
                  <tr key={row.id} className="border-b border-line last:border-b-0">
                    {sharedTab ? null : (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`Select ${row.name}`}
                          className="size-4"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-ink">{row.name}</td>
                    <td className="px-4 py-3 text-ink-muted">
                      {formatTemplateDeskType(row.deskType)}
                    </td>
                    {showOwner ? (
                      <td className="px-4 py-3 text-ink-muted">
                        {sharedTab
                          ? (row.sharedByEmail ?? "—")
                          : (row.ownerEmail ?? "—")}
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-ink-muted">
                      {row.items.length === 0
                        ? "—"
                        : row.items.map((item) => item.name).join(", ")}
                    </td>
                    {showSharedWith ? (
                      <td className="px-4 py-3 tabular-nums text-ink-muted">
                        {sharedCountLabel(row.sharedWith)}
                      </td>
                    ) : null}
                    {showStarterPack ? (
                      <td className="px-4 py-3">
                        <StarterPackMark on={row.starterPack} />
                      </td>
                    ) : null}
                    <td className="px-4 py-3 tabular-nums text-ink-muted">
                      <LocalTime at={row.updatedAtMs} mode="date" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => setEditingFolderId(row.id)}
                            className={actionLink}
                          >
                            Edit
                          </button>
                        ) : null}
                        {!sharedTab && row.visibility === "user" ? (
                          <button
                            type="button"
                            onClick={() => setSharingFolderId(row.id)}
                            className={actionLink}
                          >
                            Share
                          </button>
                        ) : null}
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => void deleteFolderRow(row)}
                            className="rounded-control border border-line px-2 py-0.5 text-xs font-medium text-danger hover:bg-danger/10"
                          >
                            Delete
                          </button>
                        ) : null}
                        {sharedTab ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const data = new FormData();
                                data.set("setId", row.id);
                                void importSharedSetAction(data).then(
                                  (result) => {
                                    flash(result);
                                    if (result.ok) {
                                      router.refresh();
                                    }
                                  },
                                );
                              }}
                              className={actionLink}
                            >
                              Import
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const data = new FormData();
                                data.set("setId", row.id);
                                void unshareSetAction(data).then((result) => {
                                  flash(result);
                                  if (result.ok) {
                                    router.refresh();
                                  }
                                });
                              }}
                              className="rounded-control border border-line px-2 py-0.5 text-xs font-medium text-danger hover:bg-danger/10"
                            >
                              Remove
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </LibraryTable>
        </>
      ) : null}

      {importing ? (
        <ImportModal
          onClose={() => setImporting(false)}
          onResult={(result) => {
            flash(result);
            if (result.ok) {
              setImporting(false);
              router.refresh();
            }
          }}
        />
      ) : null}
      {creatingFolder && tab === "sets" ? (
        <CreateFolderModal
          templates={
            variant === "admin"
              ? templates.filter((row) => row.visibility === "platform")
              : templates.filter((row) => row.visibility === "user")
          }
          visibility={variant === "admin" ? "platform" : "user"}
          onClose={() => setCreatingFolder(false)}
          onResult={(result) => {
            flash(result);
            if (result.ok) {
              setCreatingFolder(false);
              router.refresh();
            }
          }}
        />
      ) : null}
      {bulkFolderOpen ? (
        <BulkFolderModal
          folders={bulkFolders}
          onClose={() => setBulkFolderOpen(false)}
          onSubmit={async (folderId, newFolderName) => {
            const ids = listedIds.filter((id) => selected.has(id));
            const data = new FormData();
            data.set("kind", "template");
            data.set("op", "add-to-folder");
            data.set("ids", ids.join(","));
            if (folderId) {
              data.set("folderId", folderId);
            }
            if (newFolderName) {
              data.set("newFolderName", newFolderName);
            }
            const result = await bulkLibraryAction(data);
            flash(result);
            if (result.ok) {
              setSelected(new Set());
              setBulkFolderOpen(false);
            }
          }}
        />
      ) : null}
      {editingTemplate ? (
        <TemplateEditModal
          template={editingTemplate}
          variant={variant}
          folders={assignableFolders(editingTemplate, sets, variant)}
          knownFolders={knownFolders}
          onClose={() => setEditingTemplateId(null)}
          onResult={onEditSaved}
        />
      ) : null}
      {editingFolder ? (
        <FolderEditModal
          set={editingFolder}
          templates={templates}
          onClose={() => setEditingFolderId(null)}
          onResult={onEditSaved}
        />
      ) : null}
      {sharingTemplate ? (
        <ShareModal
          kind="template"
          name={sharingTemplate.name}
          id={sharingTemplate.id}
          peers={sharingTemplate.sharedWith}
          onClose={() => setSharingTemplateId(null)}
          onResult={(result) => {
            if (result.ok) {
              router.refresh();
            }
          }}
        />
      ) : null}
      {sharingFolder ? (
        <ShareModal
          kind="set"
          name={sharingFolder.name}
          id={sharingFolder.id}
          peers={sharingFolder.sharedWith}
          onClose={() => setSharingFolderId(null)}
          onResult={(result) => {
            if (result.ok) {
              router.refresh();
            }
          }}
        />
      ) : null}
    </div>
  );
}

function LibraryTable({
  empty,
  rows,
  columns,
  children,
}: {
  empty: string;
  rows: number;
  columns: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[48rem] text-left text-sm">
        {children}
        {rows === 0 ? (
          <tbody>
            <tr>
              <td colSpan={columns} className="px-4 py-6 text-sm text-ink-muted">
                {empty}
              </td>
            </tr>
          </tbody>
        ) : null}
      </table>
    </div>
  );
}

function SortTh({
  label,
  k,
  sort,
  onSort,
}: {
  label: string;
  k: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === k;
  return (
    <th className="px-4 py-3 font-medium">
      <button
        type="button"
        onClick={() => onSort(k)}
        className={active ? "text-ink" : "text-ink-faint hover:text-ink"}
      >
        {label}
        {active ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
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

function downloadJson(json: string, filename: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function ImportModal({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (result: TemplateActionResult) => void;
}) {
  const [raw, setRaw] = useState<string | null>(null);
  const [file, setFile] = useState<TemplateLibraryFile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [templateIds, setTemplateIds] = useState<Set<string>>(new Set());
  const [setIds, setSetIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  async function onPick(picked: File | undefined) {
    if (!picked) {
      return;
    }
    const text = await picked.text();
    const parsed = parseTemplateLibraryJson(text);
    if (!parsed.ok) {
      setRaw(null);
      setFile(null);
      setParseError(parsed.error);
      return;
    }
    setParseError(null);
    setRaw(text);
    setFile(parsed.file);
    setTemplateIds(new Set(parsed.file.templates.map((row) => row.id)));
    setSetIds(new Set(parsed.file.sets.map((row) => row.id)));
  }

  const lockedTemplateIds = new Set(
    (file?.sets ?? [])
      .filter((row) => setIds.has(row.id))
      .flatMap((row) => row.items),
  );

  function toggle(id: string, kind: "template" | "folder") {
    if (!file) {
      return;
    }
    if (kind === "template") {
      if (lockedTemplateIds.has(id)) {
        return;
      }
      setTemplateIds((current) => {
        const next = new Set(current);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      return;
    }
    const folder = file.sets.find((row) => row.id === id);
    const selecting = !setIds.has(id);
    setSetIds((current) => {
      const next = new Set(current);
      if (selecting) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
    if (selecting && folder) {
      setTemplateIds((current) => {
        const next = new Set(current);
        for (const templateId of folder.items) {
          next.add(templateId);
        }
        return next;
      });
    }
  }

  async function importSelected() {
    if (!raw || !file) {
      return;
    }
    setPending(true);
    const data = new FormData();
    data.set("libraryJson", raw);
    data.set("templateIds", [...templateIds].join(","));
    data.set("setIds", [...setIds].join(","));
    const result = await importTemplateLibraryAction(data);
    setPending(false);
    onResult(result);
  }

  const canImport = Boolean(file) && templateIds.size > 0;

  return (
    <Modal title="Import" onClose={onClose} wide>
      <p className="mt-1 text-sm text-ink-muted">
        Upload a JSON library file. Untick anything you do not want to import.
        A selected folder keeps its templates ticked. Import creates copies in
        your library.
      </p>
      <label className={`${secondaryBtn} mt-4 inline-flex cursor-pointer`}>
        Choose file
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => {
            const picked = event.target.files?.[0];
            event.target.value = "";
            void onPick(picked);
          }}
        />
      </label>
      {parseError ? (
        <p className="mt-3 rounded-card border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {parseError}
        </p>
      ) : null}
      {file ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ImportPickList
            title="Templates"
            empty="This file has no templates."
            rows={file.templates.map((row) => ({
              id: row.id,
              name: row.name,
              detail: formatTemplateDeskType(row.deskType),
            }))}
            selected={templateIds}
            locked={lockedTemplateIds}
            onToggle={(id) => toggle(id, "template")}
          />
          <ImportPickList
            title="Folders"
            empty="This file has no folders."
            rows={file.sets.map((row) => ({
              id: row.id,
              name: row.name,
              detail: `${formatTemplateDeskType(row.deskType)} · ${row.items.length} template${row.items.length === 1 ? "" : "s"}`,
            }))}
            selected={setIds}
            onToggle={(id) => toggle(id, "folder")}
          />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryBtn}>
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || !canImport}
          onClick={() => void importSelected()}
          className={primaryBtn}
        >
          {pending ? "Importing…" : "Import"}
        </button>
      </div>
    </Modal>
  );
}

function ImportPickList({
  title,
  empty,
  rows,
  selected,
  locked,
  onToggle,
}: {
  title: string;
  empty: string;
  rows: { id: string; name: string; detail: string }[];
  selected: Set<string>;
  locked?: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-card border border-line bg-canvas p-3">
      <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {rows.map((row) => {
            const isLocked = locked?.has(row.id) ?? false;
            return (
              <li key={row.id}>
                <label
                  className={`flex items-start gap-2 rounded-control px-1 py-1.5 text-sm text-ink ${
                    isLocked
                      ? "cursor-not-allowed text-ink-muted"
                      : "hover:bg-surface-raised"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    disabled={isLocked}
                    onChange={() => onToggle(row.id)}
                    className="mt-0.5 size-4"
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{row.name}</span>
                    <span className="text-xs text-ink-faint">{row.detail}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ShareModal({
  kind,
  name,
  id,
  peers,
  onClose,
  onResult,
}: {
  kind: "template" | "set";
  name: string;
  id: string;
  peers: { userId: string; email: string }[];
  onClose: () => void;
  onResult: (result: TemplateActionResult) => void;
}) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function share() {
    setPending(true);
    setError(null);
    setMessage(null);
    const data = new FormData();
    data.set("email", email);
    if (kind === "template") {
      data.set("templateId", id);
    } else {
      data.set("setId", id);
    }
    const result =
      kind === "template"
        ? await shareTemplateAction(data)
        : await shareSetAction(data);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "That did not work.");
      return;
    }
    setEmail("");
    setMessage(result.notes?.join(" ") || "Shared.");
    onResult(result);
  }

  async function revoke(userId: string) {
    setError(null);
    setMessage(null);
    const data = new FormData();
    data.set("toUserId", userId);
    if (kind === "template") {
      data.set("templateId", id);
    } else {
      data.set("setId", id);
    }
    const result =
      kind === "template"
        ? await unshareTemplateAction(data)
        : await unshareSetAction(data);
    if (!result.ok) {
      setError(result.error ?? "That did not work.");
      return;
    }
    setMessage(result.notes?.join(" ") || "Stopped sharing.");
    onResult(result);
  }

  return (
    <Modal
      title={kind === "template" ? "Share template" : "Share folder"}
      onClose={onClose}
    >
      <p className="mt-1 text-sm text-ink-muted">
        Grant {name} to another member by email. They can apply it on their
        desks. This is a grant, not a copy.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
          placeholder="member@email"
          className="min-w-[12rem] flex-1 rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
        />
        <button
          type="button"
          disabled={pending || !email.trim()}
          onClick={() => void share()}
          className={primaryBtn}
        >
          {pending ? "Sharing…" : "Share"}
        </button>
      </div>
      {error ? (
        <p className="mt-3 rounded-card border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-success">{message}</p> : null}
      {peers.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {peers.map((peer) => (
            <li
              key={peer.userId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink-muted"
            >
              <span>{peer.email}</span>
              <button
                type="button"
                onClick={() => void revoke(peer.userId)}
                className={dangerBtn}
              >
                Stop sharing
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-faint">Not shared with anyone yet.</p>
      )}
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onClose} className={secondaryBtn}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function BulkFolderModal({
  folders,
  onClose,
  onSubmit,
}: {
  folders: AutomationTemplateSet[];
  onClose: () => void;
  onSubmit: (folderId: string, newFolderName: string) => Promise<void>;
}) {
  const [folderId, setFolderId] = useState(folders[0]?.id ?? "");
  const [createFolder, setCreateFolder] = useState(folders.length === 0);
  const [newFolderName, setNewFolderName] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    await onSubmit(
      createFolder ? "" : folderId,
      createFolder ? newFolderName.trim() : "",
    );
    setPending(false);
  }

  return (
    <Modal title="Add to folder" onClose={onClose}>
      <p className="mt-1 text-sm text-ink-muted">
        Adds the selected templates to one folder. Mismatched desk types are
        skipped.
      </p>
      {folders.length > 0 && !createFolder ? (
        <label className="mt-3 block text-xs text-ink-muted">
          Folder
          <select
            value={folderId}
            onChange={(event) => setFolderId(event.target.value)}
            className={fieldClass}
          >
            <option value="">Choose a folder</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="mt-3 flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={createFolder}
          onChange={(event) => setCreateFolder(event.target.checked)}
          className="mt-1 size-4"
        />
        Create a new folder
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
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryBtn}>
          Cancel
        </button>
        <button
          type="button"
          disabled={
            pending ||
            (createFolder ? !newFolderName.trim() : !folderId)
          }
          onClick={() => void submit()}
          className={primaryBtn}
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
    </Modal>
  );
}

function TemplateEditModal({
  template,
  variant,
  folders,
  knownFolders,
  onClose,
  onResult,
}: {
  template: AutomationTemplate;
  variant: "account" | "admin";
  folders: AutomationTemplateSet[];
  knownFolders: AutomationTemplateSet[];
  onClose: () => void;
  onResult: (result: TemplateActionResult) => void;
}) {
  const held = foldersHolding(template.id, knownFolders).map((folder) => folder.id);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [folderIds, setFolderIds] = useState(held);
  const [createFolder, setCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [starterPack, setStarterPack] = useState(template.starterPack);
  const [publishName, setPublishName] = useState(template.name);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const data = new FormData();
    data.set("templateId", template.id);
    data.set("templateName", name);
    data.set("templateDescription", description);
    data.set("folderIds", folderIds.join(","));
    if (createFolder && newFolderName.trim()) {
      data.set("newFolderName", newFolderName.trim());
    }
    if (template.visibility === "platform" && starterPack) {
      data.set("starterPack", "1");
    }
    onResult(await updateTemplateMetaAction(data));
    setPending(false);
  }

  async function remove() {
    if (!window.confirm(`Delete “${template.name}”?`)) {
      return;
    }
    const data = new FormData();
    data.set("templateId", template.id);
    onResult(await deleteTemplateAction(data));
  }

  async function publish() {
    const data = new FormData();
    data.set("templateId", template.id);
    data.set("templateName", publishName);
    data.set("templateDescription", description);
    if (starterPack) {
      data.set("starterPack", "1");
    }
    onResult(await publishTemplateCopyAction(data));
  }

  return (
    <Modal title="Edit template" onClose={onClose}>
      <p className="mt-1 text-xs text-ink-faint">{recipePreview(template.recipe)}</p>
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
      {template.visibility === "platform" ||
      (variant === "admin" && template.visibility === "user") ? (
        <StarterPackCheckbox
          checked={starterPack}
          onChange={setStarterPack}
        />
      ) : null}
      <fieldset className="mt-3">
        <legend className="text-xs text-ink-muted">Folders</legend>
        {folders.length === 0 ? (
          <p className="mt-1 text-sm text-ink-muted">
            No folders for this desk type yet. Create one below.
          </p>
        ) : (
          <div className="mt-1 space-y-1">
            {folders.map((folder) => (
              <label key={folder.id} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={folderIds.includes(folder.id)}
                  onChange={(event) => {
                    setFolderIds((current) =>
                      event.target.checked
                        ? [...current, folder.id]
                        : current.filter((id) => id !== folder.id),
                    );
                  }}
                />
                {folder.name}
                {folder.visibility === "platform" ? (
                  <span className="text-xs text-ink-faint">Platform</span>
                ) : null}
              </label>
            ))}
          </div>
        )}
        <label className="mt-2 flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={createFolder}
            onChange={(event) => setCreateFolder(event.target.checked)}
            className="mt-1 size-4"
          />
          Create a new folder
        </label>
        {createFolder ? (
          <input
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            maxLength={80}
            placeholder="Folder name"
            className={fieldClass}
          />
        ) : null}
      </fieldset>
      {variant === "admin" && template.visibility === "user" ? (
        <label className="mt-3 block text-xs text-ink-muted">
          Publish copy as
          <input
            value={publishName}
            onChange={(event) => setPublishName(event.target.value)}
            className={fieldClass}
          />
        </label>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryBtn}>
          Cancel
        </button>
        {variant === "admin" && template.visibility === "user" ? (
          <button type="button" onClick={() => void publish()} className={secondaryBtn}>
            Publish copy to platform
          </button>
        ) : null}
        <button type="button" onClick={() => void remove()} className={dangerBtn}>
          Delete
        </button>
        <button
          type="button"
          disabled={pending || (createFolder && !newFolderName.trim())}
          onClick={() => void save()}
          className={primaryBtn}
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

function FolderEditModal({
  set,
  templates,
  onClose,
  onResult,
}: {
  set: AutomationTemplateSet;
  templates: AutomationTemplate[];
  onClose: () => void;
  onResult: (result: TemplateActionResult) => void;
}) {
  const allowed = templates.filter((row) => {
    if (row.deskType !== set.deskType) {
      return false;
    }
    if (set.visibility === "platform") {
      return row.visibility === "platform";
    }
    return row.visibility === "platform" || row.userId === set.userId;
  });
  const [name, setName] = useState(set.name);
  const [description, setDescription] = useState(set.description ?? "");
  const [starterPack, setStarterPack] = useState(set.starterPack);
  const [ids, setIds] = useState(set.items.map((item) => item.templateId));
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const data = new FormData();
    data.set("setId", set.id);
    data.set("templateName", name);
    data.set("templateDescription", description);
    data.set("templateIds", ids.join(","));
    if (set.visibility === "platform" && starterPack) {
      data.set("starterPack", "1");
    }
    onResult(await updateTemplateSetAction(data));
    setPending(false);
  }

  async function remove() {
    if (!window.confirm(`Delete folder “${set.name}”?`)) {
      return;
    }
    const data = new FormData();
    data.set("setId", set.id);
    onResult(await deleteTemplateSetAction(data));
  }

  return (
    <Modal title="Edit folder" onClose={onClose} wide>
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
      {set.visibility === "platform" ? (
        <StarterPackCheckbox
          checked={starterPack}
          onChange={setStarterPack}
        />
      ) : null}
      <FolderMembership
        allowed={allowed}
        ids={ids}
        onAdd={(id) => setIds((current) => [...current, id])}
        onRemove={(id) =>
          setIds((current) => current.filter((item) => item !== id))
        }
      />
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryBtn}>
          Cancel
        </button>
        <button type="button" onClick={() => void remove()} className={dangerBtn}>
          Delete
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void save()}
          className={primaryBtn}
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

function FolderMembership({
  allowed,
  ids,
  onAdd,
  onRemove,
}: {
  allowed: AutomationTemplate[];
  ids: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const inFolder = ids
    .map((id) => allowed.find((row) => row.id === id))
    .filter((row): row is AutomationTemplate => Boolean(row));
  const notInFolder = allowed.filter((row) => !ids.includes(row.id));

  return (
    <div className="mt-3">
      <p className="text-xs text-ink-muted">Templates</p>
      <div className="mt-1 grid gap-3 sm:grid-cols-2">
        <MembershipColumn
          title="In Folder"
          empty="None yet. Add from the other column."
          rows={inFolder}
          action="Remove"
          onAction={onRemove}
        />
        <MembershipColumn
          title="Not in Folder"
          empty="No matching templates, or they are all in this folder."
          rows={notInFolder}
          action="Add"
          onAction={onAdd}
        />
      </div>
    </div>
  );
}

function MembershipColumn({
  title,
  empty,
  rows,
  action,
  onAction,
}: {
  title: string;
  empty: string;
  rows: AutomationTemplate[];
  action: "Add" | "Remove";
  onAction: (id: string) => void;
}) {
  return (
    <div className="rounded-card border border-line bg-canvas p-3">
      <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 rounded-control border border-line bg-surface-raised px-2 py-1.5"
            >
              <span className="min-w-0 text-sm text-ink">
                <span className="block truncate">{row.name}</span>
                {row.visibility === "platform" ? (
                  <span className="text-xs text-ink-faint">Platform</span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => onAction(row.id)}
                className={
                  action === "Remove"
                    ? "shrink-0 rounded-control border border-line px-2 py-0.5 text-xs font-medium text-danger hover:bg-danger/10"
                    : "shrink-0 text-xs font-medium text-success hover:text-success"
                }
              >
                {action}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateFolderModal({
  templates,
  visibility,
  onClose,
  onResult,
}: {
  templates: AutomationTemplate[];
  visibility: "user" | "platform";
  onClose: () => void;
  onResult: (result: TemplateActionResult) => void;
}) {
  const [deskType, setDeskType] = useState<TemplateDeskType>("dca");
  const [name, setName] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [starterPack, setStarterPack] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = templates.filter((row) => row.deskType === deskType);

  async function create() {
    setPending(true);
    setError(null);
    const data = new FormData();
    data.set("templateName", name);
    data.set("deskType", deskType);
    data.set("templateIds", ids.join(","));
    data.set("visibility", visibility);
    if (visibility === "platform" && starterPack) {
      data.set("starterPack", "1");
    }
    const result = await createTemplateSetAction(data);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "That did not work.");
    }
    onResult(result);
  }

  return (
    <Modal title="Add New Folder" onClose={onClose} wide>
      <p className="mt-1 text-sm text-ink-muted">
        {visibility === "platform"
          ? "This folder is visible to every member. Name and desk type are enough; you can add templates later."
          : "Name and desk type are enough. You can add templates later."}
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
        Desk type
        <select
          value={deskType}
          onChange={(event) => {
            setDeskType(event.target.value as TemplateDeskType);
            setIds([]);
          }}
          className={fieldClass}
        >
          {(["dca", "perps", "cash_and_carry"] as const).map((type) => (
            <option key={type} value={type}>
              {formatTemplateDeskType(type)}
            </option>
          ))}
        </select>
      </label>
      {visibility === "platform" ? (
        <StarterPackCheckbox
          checked={starterPack}
          onChange={setStarterPack}
        />
      ) : null}
      <FolderMembership
        allowed={options}
        ids={ids}
        onAdd={(id) => setIds((current) => [...current, id])}
        onRemove={(id) =>
          setIds((current) => current.filter((item) => item !== id))
        }
      />
      {error ? (
        <p className="mt-3 rounded-card border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryBtn}>
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={() => void create()}
          className={primaryBtn}
        >
          {pending ? "Creating…" : "Create folder"}
        </button>
      </div>
    </Modal>
  );
}
