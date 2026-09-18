"use client";

import { useEffect, useMemo, useState } from "react";
import { useConfirmDialog } from "@/components/confirm-modal";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BacktestHighlightHover } from "@/components/backtest-highlight-hover";
import { PageHeading } from "@/components/page-heading";
import {
  SortTh,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TABLE_FILTER_FIELD_CLASS,
  TableActions,
  TableCard,
  TableFilterBar,
  TableFilterField,
  TableFilterSession,
  TableIconAction,
  TableLabelButton,
  TablePager,
} from "@/components/table-chrome";
import { AppCheck } from "@/components/app-check";
import {
  IconCheck,
  IconClose,
  IconDisable,
  IconDownload,
  IconFilterClear,
  IconFolderPlus,
  IconImport,
  IconPencil,
  IconPlus,
  IconShare,
  IconTrash,
} from "@/components/icons";
import { Modal, StarterPackCheckbox } from "@/components/template-modals";
import { sliceTablePage, type TableSortDir } from "@/lib/table-chrome";
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
import { AppMultiSelect, AppSelect } from "@/components/app-select";
import { FileDrop } from "@/components/file-drop";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";
const primaryBtn =
  "rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink hover:bg-accent";
const secondaryBtn =
  "rounded-control border border-line px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink";
const dangerBtn =
  "rounded-control border border-line px-3 py-1.5 text-xs text-danger hover:bg-danger/10";

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
  | "contract"
  | "owner"
  | "folder"
  | "shared"
  | "items"
  | "starter";

function templateContract(row: { recipe: AutomationTemplate["recipe"] }): string {
  return row.recipe.kind === "cash_and_carry" ? "" : row.recipe.symbol;
}

type SortState = { key: SortKey; dir: TableSortDir };

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
      <IconCheck
        size={16}
        className="size-4"
        aria-label="Included in Starter Pack"
      />
    </span>
  );
}

function compareText(a: string, b: string, dir: TableSortDir): number {
  const n = a.localeCompare(b, undefined, { sensitivity: "base" });
  return dir === "asc" ? n : -n;
}

function compareNum(a: number, b: number, dir: TableSortDir): number {
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
  const [sort, setSort] = useState<SortState>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
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
  const { confirm, dialog } = useConfirmDialog();

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
        templateContract(row),
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
      if (sort.key === "contract") {
        return compareText(templateContract(a), templateContract(b), sort.dir);
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
  const pagedTemplates = sliceTablePage(listedTemplates, page);
  const pagedFolders = sliceTablePage(listedFolders, page);
  const paged = templateTab ? pagedTemplates : pagedFolders;
  const pageIds = paged.rows.map((row) => row.id);
  const selectedCount = listedIds.filter((id) => selected.has(id)).length;
  const allListedSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const selectedTemplates = templates.filter(
    (row) => selected.has(row.id) && listedIds.includes(row.id),
  );
  const bulkFolders = foldersForAll(selectedTemplates, sets, variant);
  const showStarterPack = variant === "admin";
  const tableColumns =
    6 +
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
        : { key, dir: "asc" },
    );
    setPage(1);
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
    const ok = await confirm({
      title: `Delete “${row.name}”?`,
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) {
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
    const ok = await confirm({
      title: `Delete folder “${row.name}”?`,
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) {
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
    setPage(1);
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

  function clearFilters() {
    setQuery("");
    setDeskFilter("all");
    setFolderFilter("all");
    setPage(1);
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
        for (const id of pageIds) {
          next.delete(id);
        }
      } else {
        for (const id of pageIds) {
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
    if (op === "delete") {
      const ok = await confirm({
        title: `Delete ${ids.length} ${plural}?`,
        message: "This cannot be undone.",
        confirmLabel: "Delete",
        danger: true,
      });
      if (!ok) {
        return;
      }
    }
    if (op === "unpublish") {
      const ok = await confirm({
        title: `Unpublish ${ids.length} platform ${plural}?`,
        message: "Members will no longer see them. User copies stay.",
        confirmLabel: "Unpublish",
      });
      if (!ok) {
        return;
      }
    }
    if (op === "publish") {
      const ok = await confirm({
        title: `Publish ${ids.length} ${plural}?`,
        message: "Publish as platform copies. User rows stay.",
        confirmLabel: "Publish",
      });
      if (!ok) {
        return;
      }
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
      <TableFilterSession
        toolbar={
          sharedTab || selectedCount === 0 ? undefined : (
            <>
              <p className="text-sm text-ink-muted">{selectedCount} selected</p>
              {tab === "templates" ? (
                <TableLabelButton
                  variant="bulk"
                  icon={<IconFolderPlus {...TABLE_BTN_ICON} />}
                  onClick={openBulkFolder}
                >
                  Add to folder
                </TableLabelButton>
              ) : null}
              <TableLabelButton
                variant="bulk"
                icon={<IconDownload {...TABLE_BTN_ICON} />}
                onClick={() => void exportSelected()}
              >
                Export
              </TableLabelButton>
              {variant === "admin" ? (
                <TableLabelButton
                  variant="bulk"
                  icon={<IconDisable {...TABLE_BTN_ICON} />}
                  onClick={() => void runBulk("unpublish")}
                >
                  Unpublish
                </TableLabelButton>
              ) : null}
              <TableLabelButton
                variant="danger"
                icon={<IconTrash {...TABLE_BTN_ICON} />}
                onClick={() => void runBulk("delete")}
              >
                Delete
              </TableLabelButton>
              <TableLabelButton
                variant="bulk"
                icon={<IconClose {...TABLE_BTN_ICON} />}
                onClick={() => setSelected(new Set())}
              >
                Clear
              </TableLabelButton>
            </>
          )
        }
        actions={
          sharedTab ? undefined : (
            <>
              <TableLabelButton
                variant="secondary"
                icon={<IconDownload {...TABLE_BTN_ICON} />}
                onClick={() => void exportAll()}
              >
                Export all
              </TableLabelButton>
              <TableLabelButton
                variant="secondary"
                icon={<IconImport {...TABLE_BTN_ICON} />}
                onClick={() => setImporting(true)}
              >
                Import
              </TableLabelButton>
              {tab === "sets" ? (
                <TableLabelButton
                  variant="primary"
                  icon={<IconPlus {...TABLE_BTN_ICON} />}
                  onClick={() => setCreatingFolder(true)}
                >
                  Add New Folder
                </TableLabelButton>
              ) : null}
            </>
          )
        }
      >
          <TableFilterBar>
            <TableFilterField label="Search">
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Name or contract"
                autoComplete="off"
                className={TABLE_FILTER_FIELD_CLASS}
              />
            </TableFilterField>
            <TableFilterField label="Desk type">
              <AppSelect
                value={deskFilter}
                onChange={(event) => {
                  setDeskFilter(event.target.value as "all" | TemplateDeskType);
                  setPage(1);
                }}
                className={TABLE_FILTER_FIELD_CLASS}
              >
                <option value="all">All desk types</option>
                <option value="dca">DCA</option>
                <option value="perps">Perps bots</option>
                <option value="cash_and_carry">Cash and Carry</option>
              </AppSelect>
            </TableFilterField>
            {tab === "templates" || tab === "shared-templates" ? (
              <TableFilterField label="Folder">
                <AppSelect
                  value={folderFilter}
                  onChange={(event) => {
                    setFolderFilter(event.target.value);
                    setPage(1);
                  }}
                  className={TABLE_FILTER_FIELD_CLASS}
                >
                  <option value="all">All folders</option>
                  {folderFilterOptions.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </AppSelect>
              </TableFilterField>
            ) : null}
            <TableLabelButton
              variant="filter"
              icon={<IconFilterClear {...TABLE_BTN_ICON} />}
              onClick={clearFilters}
            >
              Clear
            </TableLabelButton>
          </TableFilterBar>
      </TableFilterSession>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}

      {tab === "templates" || tab === "shared-templates" ? (
        <>
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
          pager={
            <TablePager
              window={pagedTemplates.window}
              onPrev={() => setPage(pagedTemplates.window.page - 1)}
              onNext={() => setPage(pagedTemplates.window.page + 1)}
            />
          }
        >
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              {sharedTab ? null : (
                <th className="w-10 px-4 py-3">
                  <AppCheck
                    checked={allListedSelected}
                    onChange={toggleAllListed}
                    aria-label="Select all templates"
                    className=""
                  />
                </th>
              )}
              <SortTh
                label="Name"
                active={sort.key === "name"}
                dir={sort.dir}
                onSort={() => onSort("name")}
              />
              <SortTh
                label="Folder"
                active={sort.key === "folder"}
                dir={sort.dir}
                onSort={() => onSort("folder")}
              />
              <SortTh
                label="Desk Type"
                active={sort.key === "deskType"}
                dir={sort.dir}
                onSort={() => onSort("deskType")}
              />
              <SortTh
                label="Contract"
                active={sort.key === "contract"}
                dir={sort.dir}
                onSort={() => onSort("contract")}
              />
              <th className="px-4 py-3 font-medium">Backtests</th>
              {showOwner ? (
                <SortTh
                  label={sharedTab ? "Shared by" : "Owner"}
                  active={sort.key === (sharedTab ? "shared" : "owner")}
                  dir={sort.dir}
                  onSort={() => onSort(sharedTab ? "shared" : "owner")}
                />
              ) : null}
              {showSharedWith ? (
                <SortTh
                  label="Shared with"
                  active={sort.key === "shared"}
                  dir={sort.dir}
                  onSort={() => onSort("shared")}
                />
              ) : null}
              {showStarterPack ? (
                <SortTh
                  label="Starter Pack"
                  active={sort.key === "starter"}
                  dir={sort.dir}
                  onSort={() => onSort("starter")}
                />
              ) : null}
              <th className={TABLE_ACTIONS_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedTemplates.rows.map((row) => {
              const canEdit =
                !sharedTab &&
                (variant === "admin" || row.visibility === "user");
              const linkedRun = linkedBacktests[row.id];
              return (
                <tr key={row.id} className="border-b border-line last:border-b-0">
                  {sharedTab ? null : (
                    <td className="px-4 py-3">
                      <AppCheck
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select ${row.name}`}
                        className=""
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-ink">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {folderLabel(foldersHolding(row.id, knownFolders))}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {formatTemplateDeskType(row.deskType)}
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums">
                    {templateContract(row) || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {linkedRun ? (
                      <BacktestHighlightHover highlight={linkedRun}>
                        <Link
                          href={`/account/backtests/${linkedRun.runId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline"
                        >
                          Open
                        </Link>
                      </BacktestHighlightHover>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  {showOwner ? (
                    <td className="px-4 py-3 text-ink-muted">
                      {sharedTab
                        ? (row.sharedByEmail ?? "—")
                        : (row.ownerEmail ?? "—")}
                    </td>
                  ) : null}
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
                  <td className={TABLE_ACTIONS_TD_CLASS}>
                    <TableActions>
                      {canEdit ? (
                        <TableIconAction
                          label="Edit"
                          detail="Change this template."
                          onClick={() => setEditingTemplateId(row.id)}
                        >
                          <IconPencil {...TABLE_BTN_ICON} />
                        </TableIconAction>
                      ) : null}
                      {!sharedTab && row.visibility === "user" ? (
                        <TableIconAction
                          label="Share"
                          detail="Share this template with another member."
                          onClick={() => setSharingTemplateId(row.id)}
                        >
                          <IconShare {...TABLE_BTN_ICON} />
                        </TableIconAction>
                      ) : null}
                      {canEdit ? (
                        <TableIconAction
                          danger
                          label="Delete"
                          detail="Delete this template."
                          onClick={() => void deleteTemplateRow(row)}
                        >
                          <IconTrash {...TABLE_BTN_ICON} />
                        </TableIconAction>
                      ) : null}
                      {sharedTab ? (
                        <>
                          <TableIconAction
                            label="Import"
                            detail="Copy this shared template into your library."
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
                          >
                            <IconImport {...TABLE_BTN_ICON} />
                          </TableIconAction>
                          <TableIconAction
                            danger
                            label="Remove"
                            detail="Remove this shared template from your list."
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
                          >
                            <IconTrash {...TABLE_BTN_ICON} />
                          </TableIconAction>
                        </>
                      ) : null}
                    </TableActions>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </LibraryTable>
        </>
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
            pager={
              <TablePager
                window={pagedFolders.window}
                onPrev={() => setPage(pagedFolders.window.page - 1)}
                onNext={() => setPage(pagedFolders.window.page + 1)}
              />
            }
          >
            <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
              <tr>
                {sharedTab ? null : (
                  <th className="w-10 px-4 py-3">
                    <AppCheck
                      checked={allListedSelected}
                      onChange={toggleAllListed}
                      aria-label="Select all folders"
                      className=""
                    />
                  </th>
                )}
                <SortTh
                  label="Name"
                  active={sort.key === "name"}
                  dir={sort.dir}
                  onSort={() => onSort("name")}
                />
                <SortTh
                  label="Desk Type"
                  active={sort.key === "deskType"}
                  dir={sort.dir}
                  onSort={() => onSort("deskType")}
                />
                {showOwner ? (
                  <SortTh
                    label={sharedTab ? "Shared by" : "Owner"}
                    active={sort.key === (sharedTab ? "shared" : "owner")}
                    dir={sort.dir}
                    onSort={() => onSort(sharedTab ? "shared" : "owner")}
                  />
                ) : null}
                <SortTh
                  label="Templates"
                  active={sort.key === "items"}
                  dir={sort.dir}
                  onSort={() => onSort("items")}
                  className="w-36 max-w-36"
                />
                {showSharedWith ? (
                  <SortTh
                    label="Shared with"
                    active={sort.key === "shared"}
                    dir={sort.dir}
                    onSort={() => onSort("shared")}
                  />
                ) : null}
                {showStarterPack ? (
                  <SortTh
                    label="Starter Pack"
                    active={sort.key === "starter"}
                    dir={sort.dir}
                    onSort={() => onSort("starter")}
                  />
                ) : null}
                <th className={TABLE_ACTIONS_TH_CLASS}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedFolders.rows.map((row) => {
                const canEdit =
                  !sharedTab &&
                  (variant === "admin" || row.visibility === "user");
                return (
                  <tr key={row.id} className="border-b border-line last:border-b-0">
                    {sharedTab ? null : (
                      <td className="px-4 py-3">
                        <AppCheck
                          checked={selected.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`Select ${row.name}`}
                          className=""
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
                    <td className="max-w-36 overflow-hidden px-4 py-3 text-ink-muted">
                      {row.items.length === 0 ? (
                        "—"
                      ) : (
                        <span className="line-clamp-2 break-words">
                          {row.items.map((item) => item.name).join(", ")}
                        </span>
                      )}
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
                    <td className={TABLE_ACTIONS_TD_CLASS}>
                      <TableActions>
                        {canEdit ? (
                          <TableIconAction
                            label="Edit"
                            detail="Change this folder."
                            onClick={() => setEditingFolderId(row.id)}
                          >
                            <IconPencil {...TABLE_BTN_ICON} />
                          </TableIconAction>
                        ) : null}
                        {!sharedTab && row.visibility === "user" ? (
                          <TableIconAction
                            label="Share"
                            detail="Share this folder with another member."
                            onClick={() => setSharingFolderId(row.id)}
                          >
                            <IconShare {...TABLE_BTN_ICON} />
                          </TableIconAction>
                        ) : null}
                        {canEdit ? (
                          <TableIconAction
                            danger
                            label="Delete"
                            detail="Delete this folder."
                            onClick={() => void deleteFolderRow(row)}
                          >
                            <IconTrash {...TABLE_BTN_ICON} />
                          </TableIconAction>
                        ) : null}
                        {sharedTab ? (
                          <>
                            <TableIconAction
                              label="Import"
                              detail="Copy this shared folder into your library."
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
                            >
                              <IconImport {...TABLE_BTN_ICON} />
                            </TableIconAction>
                            <TableIconAction
                              danger
                              label="Remove"
                              detail="Remove this shared folder from your list."
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
                            >
                              <IconTrash {...TABLE_BTN_ICON} />
                            </TableIconAction>
                          </>
                        ) : null}
                      </TableActions>
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
      {dialog}
    </div>
  );
}

function LibraryTable({
  empty,
  rows,
  columns,
  children,
  pager,
}: {
  empty: string;
  rows: number;
  columns: number;
  children: React.ReactNode;
  pager?: React.ReactNode;
}) {
  return (
    <TableCard pager={pager}>
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
    </TableCard>
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
      <div className="mt-4">
        <FileDrop
          accept="application/json,.json"
          hint="JSON library export."
          onFile={(picked) => void onPick(picked)}
        />
      </div>
      {parseError ? (
        <p className="mt-3 rounded-card border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {parseError}
        </p>
      ) : null}
      {file ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs text-ink-muted">
            Templates
            {file.templates.length === 0 ? (
              <p className="mt-1 text-sm text-ink-muted">
                This file has no templates.
              </p>
            ) : (
              <AppMultiSelect
                className="mt-1"
                value={[...templateIds]}
                onChange={(next) => {
                  const kept = new Set(next);
                  for (const id of lockedTemplateIds) {
                    kept.add(id);
                  }
                  setTemplateIds(kept);
                }}
                placeholder="Templates"
                options={file.templates.map((row) => ({
                  value: row.id,
                  label: `${row.name} · ${formatTemplateDeskType(row.deskType)}`,
                  disabled: lockedTemplateIds.has(row.id),
                }))}
              />
            )}
          </label>
          <label className="block text-xs text-ink-muted">
            Folders
            {file.sets.length === 0 ? (
              <p className="mt-1 text-sm text-ink-muted">
                This file has no folders.
              </p>
            ) : (
              <AppMultiSelect
                className="mt-1"
                value={[...setIds]}
                onChange={(next) => {
                  const added = next.filter((id) => !setIds.has(id));
                  setSetIds(new Set(next));
                  if (added.length === 0) {
                    return;
                  }
                  setTemplateIds((current) => {
                    const kept = new Set(current);
                    for (const id of added) {
                      const folder = file.sets.find((row) => row.id === id);
                      for (const templateId of folder?.items ?? []) {
                        kept.add(templateId);
                      }
                    }
                    return kept;
                  });
                }}
                placeholder="Folders"
                options={file.sets.map((row) => ({
                  value: row.id,
                  label: `${row.name} · ${formatTemplateDeskType(row.deskType)} · ${row.items.length} template${row.items.length === 1 ? "" : "s"}`,
                }))}
              />
            )}
          </label>
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
          <AppSelect
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
          </AppSelect>
        </label>
      ) : null}
      <label className="mt-3 flex items-start gap-2 text-sm text-ink">
        <AppCheck
          checked={createFolder}
          onChange={(event) => setCreateFolder(event.target.checked)}
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
  const { confirm, dialog } = useConfirmDialog();

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
    const ok = await confirm({
      title: `Delete “${template.name}”?`,
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) {
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
    <>
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
          <AppMultiSelect
            className="mt-1"
            value={folderIds}
            onChange={setFolderIds}
            placeholder="Folders"
            options={folders.map((folder) => ({
              value: folder.id,
              label:
                folder.visibility === "platform"
                  ? `${folder.name} (Platform)`
                  : folder.name,
            }))}
          />
        )}
        <label className="mt-2 flex items-start gap-2 text-sm text-ink">
          <AppCheck
            checked={createFolder}
            onChange={(event) => setCreateFolder(event.target.checked)}
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
    {dialog}
    </>
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
  const { confirm, dialog } = useConfirmDialog();

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
    const ok = await confirm({
      title: `Delete folder “${set.name}”?`,
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) {
      return;
    }
    const data = new FormData();
    data.set("setId", set.id);
    onResult(await deleteTemplateSetAction(data));
  }

  return (
    <>
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
    {dialog}
    </>
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
        <AppSelect
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
        </AppSelect>
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
