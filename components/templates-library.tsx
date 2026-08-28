"use client";

import { useMemo, useState } from "react";
import { LocalTime } from "@/components/local-time";
import { Modal } from "@/components/template-modals";
import { formatDeskType } from "@/lib/accounts/model";
import {
  createTemplateSetAction,
  deleteTemplateAction,
  deleteTemplateSetAction,
  exportTemplateLibraryAction,
  importTemplateLibraryAction,
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
import type { TemplateDeskType } from "@/lib/templates/recipe";
import { recipePreview } from "@/lib/templates/recipe";
import type {
  AutomationTemplate,
  AutomationTemplateSet,
} from "@/lib/templates/store";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";
const primaryBtn =
  "rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink hover:bg-accent";
const secondaryBtn =
  "rounded-control border border-line px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink";
const dangerBtn =
  "rounded-control px-3 py-1.5 text-xs text-danger hover:bg-danger/10";
const actionLink =
  "text-xs font-medium text-accent hover:text-accent-strong";

type LibraryTab = "templates" | "sets" | "shared-templates" | "shared-sets";

type SortKey =
  | "name"
  | "deskType"
  | "visibility"
  | "owner"
  | "folder"
  | "shared"
  | "updated"
  | "items";

type SortState = { key: SortKey; dir: "asc" | "desc" };

function foldersHolding(
  templateId: string,
  folders: AutomationTemplateSet[],
): AutomationTemplateSet[] {
  return folders.filter((folder) =>
    folder.items.some((item) => item.templateId === templateId),
  );
}

function folderLabel(folders: AutomationTemplateSet[]): string {
  if (folders.length === 0) {
    return "—";
  }
  return folders.map((folder) => folder.name).join(", ");
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
  templates,
  sets,
  sharedTemplates = [],
  sharedSets = [],
}: {
  variant: "account" | "admin";
  templates: AutomationTemplate[];
  sets: AutomationTemplateSet[];
  sharedTemplates?: AutomationTemplate[];
  sharedSets?: AutomationTemplateSet[];
}) {
  const [tab, setTab] = useState<LibraryTab>("templates");
  const [deskFilter, setDeskFilter] = useState<"all" | TemplateDeskType>("all");
  const [scope, setScope] = useState<"all" | "platform" | "user">("all");
  const [folderFilter, setFolderFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "updated", dir: "desc" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkFolderOpen, setBulkFolderOpen] = useState(false);

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
    if (deskFilter !== "all" && row.deskType !== deskFilter) {
      return false;
    }
    if (scope === "platform") {
      return row.visibility === "platform";
    }
    if (scope === "user") {
      return row.visibility === "user";
    }
    return true;
  });
  const filteredSets = sets.filter((row) => {
    if (variant === "account" && row.visibility === "platform") {
      return false;
    }
    if (deskFilter !== "all" && row.deskType !== deskFilter) {
      return false;
    }
    if (scope === "platform") {
      return row.visibility === "platform";
    }
    if (scope === "user") {
      return row.visibility === "user";
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
        formatDeskType(row.deskType),
        folderLabel(held),
        sharedLabel(row.sharedWith, row.sharedByEmail),
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
      if (sort.key === "visibility") {
        return compareText(a.visibility, b.visibility, sort.dir);
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
        return compareText(
          sharedLabel(a.sharedWith, a.sharedByEmail),
          sharedLabel(b.sharedWith, b.sharedByEmail),
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
          formatDeskType(row.deskType),
          row.items.map((item) => item.name).join(" "),
          sharedLabel(row.sharedWith, row.sharedByEmail),
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
      if (sort.key === "visibility") {
        return compareText(a.visibility, b.visibility, sort.dir);
      }
      if (sort.key === "owner") {
        return compareText(a.ownerEmail ?? "", b.ownerEmail ?? "", sort.dir);
      }
      if (sort.key === "items") {
        return compareNum(a.items.length, b.items.length, sort.dir);
      }
      if (sort.key === "shared") {
        return compareText(
          sharedLabel(a.sharedWith, a.sharedByEmail),
          sharedLabel(b.sharedWith, b.sharedByEmail),
          sort.dir,
        );
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

  const showOwner = variant === "admin" || tab.startsWith("shared");
  const sharedTab = tab.startsWith("shared");
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
  const tableColumns =
    6 +
    (sharedTab ? 0 : 1) +
    (showOwner ? 1 : 0) +
    (sharedTab ? 0 : 1);

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
    }
  }

  function changeTab(next: LibraryTab) {
    setTab(next);
    setSelected(new Set());
    setBulkFolderOpen(false);
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

  return (
    <div>
      <nav className="mt-5 flex flex-wrap border-b border-line">
        <TabButton selected={tab === "templates"} onClick={() => changeTab("templates")}>
          {variant === "admin" ? "Templates" : "My Templates"}
        </TabButton>
        <TabButton selected={tab === "sets"} onClick={() => changeTab("sets")}>
          {variant === "admin" ? "Folders" : "My Folders"}
        </TabButton>
        <TabButton
          selected={tab === "shared-templates"}
          onClick={() => changeTab("shared-templates")}
        >
          Shared Templates
        </TabButton>
        <TabButton selected={tab === "shared-sets"} onClick={() => changeTab("shared-sets")}>
          Shared Folders
        </TabButton>
      </nav>
      <LibraryTransferBar
        exportScope={variant === "admin" ? "all" : "own"}
        onResult={flash}
      />
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
            <option value="perps">Perps</option>
            <option value="cash_and_carry">Cash and Carry</option>
          </select>
        </label>
        {variant === "admin" && (tab === "templates" || tab === "sets") ? (
          <label className="block text-xs text-ink-muted">
            Scope
            <select
              value={scope}
              onChange={(event) =>
                setScope(event.target.value as "all" | "platform" | "user")
              }
              className={fieldClass}
            >
              <option value="all">Platform and user</option>
              <option value="platform">Platform</option>
              <option value="user">User</option>
            </select>
          </label>
        ) : null}
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
          {variant === "admin" ? (
            <>
              <button
                type="button"
                onClick={() => void runBulk("publish")}
                className={secondaryBtn}
              >
                Publish
              </button>
              <button
                type="button"
                onClick={() => void runBulk("unpublish")}
                className={secondaryBtn}
              >
                Unpublish
              </button>
            </>
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
                : "No templates match these filters."
              : "Nothing shared with you yet. Another member can share a template by entering your email."
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
              <SortTh label="Desk" k="deskType" sort={sort} onSort={onSort} />
              <SortTh label="Scope" k="visibility" sort={sort} onSort={onSort} />
              {showOwner ? (
                <SortTh
                  label={sharedTab ? "Shared by" : "Owner"}
                  k={sharedTab ? "shared" : "owner"}
                  sort={sort}
                  onSort={onSort}
                />
              ) : null}
              <SortTh label="Folder" k="folder" sort={sort} onSort={onSort} />
              {sharedTab ? null : (
                <SortTh label="Shared with" k="shared" sort={sort} onSort={onSort} />
              )}
              <SortTh label="Updated" k="updated" sort={sort} onSort={onSort} />
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listedTemplates.map((row) => {
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
                    {formatDeskType(row.deskType)}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {row.visibility === "platform" ? "Platform" : "User"}
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
                  {sharedTab ? null : (
                    <td className="px-4 py-3 text-ink-muted">
                      {sharedLabel(row.sharedWith)}
                    </td>
                  )}
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
                      {sharedTab ? (
                        <button
                          type="button"
                          onClick={() => {
                            const data = new FormData();
                            data.set("templateId", row.id);
                            void unshareTemplateAction(data).then(flash);
                          }}
                          className="text-xs font-medium text-danger hover:text-danger"
                        >
                          Remove
                        </button>
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
                ? "No folders yet. Create one below from templates of the same desk type."
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
                <SortTh label="Desk" k="deskType" sort={sort} onSort={onSort} />
                <SortTh label="Scope" k="visibility" sort={sort} onSort={onSort} />
                {showOwner ? (
                  <SortTh
                    label={sharedTab ? "Shared by" : "Owner"}
                    k={sharedTab ? "shared" : "owner"}
                    sort={sort}
                    onSort={onSort}
                  />
                ) : null}
                <SortTh label="Templates" k="items" sort={sort} onSort={onSort} />
                {sharedTab ? null : (
                  <SortTh label="Shared with" k="shared" sort={sort} onSort={onSort} />
                )}
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
                      {formatDeskType(row.deskType)}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {row.visibility === "platform" ? "Platform" : "User"}
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
                    {sharedTab ? null : (
                      <td className="px-4 py-3 text-ink-muted">
                        {sharedLabel(row.sharedWith)}
                      </td>
                    )}
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
                        {sharedTab ? (
                          <button
                            type="button"
                            onClick={() => {
                              const data = new FormData();
                              data.set("setId", row.id);
                              void unshareSetAction(data).then(flash);
                            }}
                            className="text-xs font-medium text-danger hover:text-danger"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </LibraryTable>
          {tab === "sets" ? (
            <div className="mt-4">
              {variant === "account" ? (
                <CreateSetCard
                  templates={templates.filter((row) => row.visibility === "user")}
                  visibility="user"
                  onResult={flash}
                />
              ) : (
                <CreateSetCard
                  templates={templates.filter((row) => row.visibility === "platform")}
                  visibility="platform"
                  onResult={flash}
                />
              )}
            </div>
          ) : null}
        </>
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
          onShare={flash}
          onResult={onEditSaved}
        />
      ) : null}
      {editingFolder ? (
        <FolderEditModal
          set={editingFolder}
          templates={templates}
          onClose={() => setEditingFolderId(null)}
          onShare={flash}
          onResult={onEditSaved}
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

function LibraryTransferBar({
  exportScope,
  onResult,
}: {
  exportScope: "own" | "all";
  onResult: (result: TemplateActionResult) => void;
}) {
  async function onExport() {
    const data = new FormData();
    data.set("scope", exportScope);
    onResult(await exportTemplateLibraryAction(data));
  }

  async function onImport(file: File | undefined) {
    if (!file) {
      return;
    }
    const text = await file.text();
    const data = new FormData();
    data.set("libraryJson", text);
    onResult(await importTemplateLibraryAction(data));
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void onExport()} className={secondaryBtn}>
        Export all
      </button>
      <label className={`${secondaryBtn} cursor-pointer`}>
        Import all
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void onImport(file);
          }}
        />
      </label>
    </div>
  );
}

function ShareControls({
  kind,
  id,
  peers,
  onResult,
}: {
  kind: "template" | "set";
  id: string;
  peers: { userId: string; email: string }[];
  onResult: (result: TemplateActionResult) => void;
}) {
  const [email, setEmail] = useState("");

  async function share() {
    const data = new FormData();
    data.set("email", email);
    if (kind === "template") {
      data.set("templateId", id);
      onResult(await shareTemplateAction(data));
    } else {
      data.set("setId", id);
      onResult(await shareSetAction(data));
    }
    setEmail("");
  }

  async function revoke(userId: string) {
    const data = new FormData();
    data.set("toUserId", userId);
    if (kind === "template") {
      data.set("templateId", id);
      onResult(await unshareTemplateAction(data));
    } else {
      data.set("setId", id);
      onResult(await unshareSetAction(data));
    }
  }

  return (
    <div className="mt-3 rounded-control border border-line bg-canvas px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
        Share with other user
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="member@email"
          className="min-w-[12rem] flex-1 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
        />
        <button
          type="button"
          disabled={!email.trim()}
          onClick={() => void share()}
          className={secondaryBtn}
        >
          Share
        </button>
      </div>
      {peers.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {peers.map((peer) => (
            <li
              key={peer.userId}
              className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted"
            >
              <span>Shared with {peer.email}</span>
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
      ) : null}
    </div>
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
  onShare,
  onResult,
}: {
  template: AutomationTemplate;
  variant: "account" | "admin";
  folders: AutomationTemplateSet[];
  knownFolders: AutomationTemplateSet[];
  onClose: () => void;
  onShare: (result: TemplateActionResult) => void;
  onResult: (result: TemplateActionResult) => void;
}) {
  const held = foldersHolding(template.id, knownFolders).map((folder) => folder.id);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [folderIds, setFolderIds] = useState(held);
  const [createFolder, setCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [publishName, setPublishName] = useState(template.name);
  const [pending, setPending] = useState(false);
  const canShare = template.visibility === "user";

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
    onResult(await publishTemplateCopyAction(data));
  }

  return (
    <Modal title="Edit template" onClose={onClose}>
      <p className="mt-1 text-xs text-ink-muted">
        {formatDeskType(template.deskType)} ·{" "}
        {template.visibility === "platform" ? "Platform" : "User"}
        {template.ownerEmail ? ` · ${template.ownerEmail}` : ""}
      </p>
      <p className="mt-2 text-xs text-ink-faint">{recipePreview(template.recipe)}</p>
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
      {canShare ? (
        <ShareControls
          kind="template"
          id={template.id}
          peers={template.sharedWith}
          onResult={onShare}
        />
      ) : null}
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
  onShare,
  onResult,
}: {
  set: AutomationTemplateSet;
  templates: AutomationTemplate[];
  onClose: () => void;
  onShare: (result: TemplateActionResult) => void;
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
  const [ids, setIds] = useState(set.items.map((item) => item.templateId));
  const [pending, setPending] = useState(false);
  const canShare = set.visibility === "user";

  async function save() {
    setPending(true);
    const data = new FormData();
    data.set("setId", set.id);
    data.set("templateName", name);
    data.set("templateDescription", description);
    data.set("templateIds", ids.join(","));
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
      <p className="mt-1 text-xs text-ink-muted">
        {formatDeskType(set.deskType)} ·{" "}
        {set.visibility === "platform" ? "Platform" : "User"}
        {set.ownerEmail ? ` · ${set.ownerEmail}` : ""}
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
      <FolderMembership
        allowed={allowed}
        ids={ids}
        onAdd={(id) => setIds((current) => [...current, id])}
        onRemove={(id) =>
          setIds((current) => current.filter((item) => item !== id))
        }
      />
      {canShare ? (
        <ShareControls
          kind="set"
          id={set.id}
          peers={set.sharedWith}
          onResult={onShare}
        />
      ) : null}
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
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                    ? "shrink-0 text-xs font-medium text-danger hover:text-danger"
                    : actionLink
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

function CreateSetCard({
  templates,
  visibility,
  onResult,
}: {
  templates: AutomationTemplate[];
  visibility: "user" | "platform";
  onResult: (result: TemplateActionResult) => void;
}) {
  const [deskType, setDeskType] = useState<TemplateDeskType>("dca");
  const [name, setName] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const options = templates.filter((row) => row.deskType === deskType);

  async function create() {
    const data = new FormData();
    data.set("templateName", name);
    data.set("deskType", deskType);
    data.set("templateIds", ids.join(","));
    data.set("visibility", visibility);
    onResult(await createTemplateSetAction(data));
    setName("");
    setIds([]);
  }

  return (
    <article className="rounded-card border border-dashed border-line bg-canvas p-4">
      <p className="text-sm font-semibold text-ink">
        {visibility === "platform" ? "New platform folder" : "New folder"}
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        Name and desk type are enough. You can add templates later.
      </p>
      <label className="mt-2 block text-xs text-ink-muted">
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="mt-2 block text-xs text-ink-muted">
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
              {formatDeskType(type)}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-2 space-y-1">
        {options.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No templates of this desk type yet.
          </p>
        ) : (
          options.map((row) => (
            <label key={row.id} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={ids.includes(row.id)}
                onChange={(event) => {
                  setIds((current) =>
                    event.target.checked
                      ? [...current, row.id]
                      : current.filter((id) => id !== row.id),
                  );
                }}
              />
              {row.name}
              {row.visibility === "platform" ? (
                <span className="text-xs text-ink-faint">Platform</span>
              ) : null}
            </label>
          ))
        )}
      </div>
      <button
        type="button"
        disabled={!name.trim()}
        onClick={() => void create()}
        className={`${primaryBtn} mt-3`}
      >
        Create folder
      </button>
    </article>
  );
}
