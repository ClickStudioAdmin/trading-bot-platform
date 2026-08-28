"use client";

import { useMemo, useState } from "react";
import { formatDeskType } from "@/lib/accounts/model";
import {
  applyTemplateAction,
  applyTemplateSetAction,
  createTemplateSetAction,
  deleteTemplateAction,
  deleteTemplateSetAction,
  exportTemplateLibraryAction,
  importTemplateLibraryAction,
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
import type {
  AutomationTemplate,
  AutomationTemplateSet,
} from "@/lib/templates/store";
import { recipePreview } from "@/lib/templates/recipe";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";
const primaryBtn =
  "rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink hover:bg-accent";
const secondaryBtn =
  "rounded-control border border-line px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink";
const dangerBtn =
  "rounded-control px-3 py-1.5 text-xs text-danger hover:bg-danger/10";

type DeskOption = {
  id: string;
  name: string;
  deskType: TemplateDeskType;
};

type LibraryTab = "templates" | "sets" | "shared-templates" | "shared-sets";

export function TemplatesLibrary({
  variant,
  templates,
  sets,
  sharedTemplates = [],
  sharedSets = [],
  desks,
}: {
  variant: "account" | "admin";
  templates: AutomationTemplate[];
  sets: AutomationTemplateSet[];
  sharedTemplates?: AutomationTemplate[];
  sharedSets?: AutomationTemplateSet[];
  desks: DeskOption[];
}) {
  const [tab, setTab] = useState<LibraryTab>("templates");
  const [deskFilter, setDeskFilter] = useState<"all" | TemplateDeskType>("all");
  const [scope, setScope] = useState<"all" | "platform" | "user">(
    variant === "admin" ? "all" : "all",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredTemplates = templates.filter((row) => {
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

  function flash(result: TemplateActionResult) {
    if (result.json && result.filename) {
      downloadJson(result.json, result.filename);
    }
    if (result.ok) {
      setError(null);
      setMessage(
        result.notes?.join(" ") ||
          (result.json ? "Downloaded." : "Saved."),
      );
    } else {
      setMessage(null);
      setError(result.error ?? "That did not work.");
    }
  }

  return (
    <div>
      <nav className="mt-5 flex flex-wrap border-b border-line">
        <TabButton selected={tab === "templates"} onClick={() => setTab("templates")}>
          Templates
        </TabButton>
        <TabButton selected={tab === "sets"} onClick={() => setTab("sets")}>
          Sets
        </TabButton>
        <TabButton
          selected={tab === "shared-templates"}
          onClick={() => setTab("shared-templates")}
        >
          Shared Templates
        </TabButton>
        <TabButton selected={tab === "shared-sets"} onClick={() => setTab("shared-sets")}>
          Shared Sets
        </TabButton>
      </nav>
      <LibraryTransferBar
        exportScope={variant === "admin" ? "all" : "own"}
        onResult={flash}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <select
          value={deskFilter}
          onChange={(event) =>
            setDeskFilter(event.target.value as "all" | TemplateDeskType)
          }
          className="rounded-control border border-line bg-canvas px-3 py-1.5 text-sm text-ink"
        >
          <option value="all">All desk types</option>
          <option value="dca">DCA</option>
          <option value="perps">Perps</option>
          <option value="cash_and_carry">Cash and Carry</option>
        </select>
        {variant === "admin" && (tab === "templates" || tab === "sets") ? (
          <select
            value={scope}
            onChange={(event) =>
              setScope(event.target.value as "all" | "platform" | "user")
            }
            className="rounded-control border border-line bg-canvas px-3 py-1.5 text-sm text-ink"
          >
            <option value="all">Platform and user</option>
            <option value="platform">Platform</option>
            <option value="user">User</option>
          </select>
        ) : null}
      </div>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}

      {tab === "templates" ? (
        <div className="mt-6 space-y-3">
          {filteredTemplates.length === 0 ? (
            <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
              {variant === "account"
                ? "No templates yet. Open Automations on a DCA, Perps, or Cash and Carry desk and use Save as template."
                : "No templates match these filters."}
            </p>
          ) : (
            filteredTemplates.map((row) => (
              <TemplateCard
                key={row.id}
                template={row}
                variant={variant}
                desks={desks}
                onResult={flash}
              />
            ))
          )}
          {variant === "account" ? (
            <CreateSetCard
              templates={templates.filter(
                (row) =>
                  row.visibility === "user" || row.visibility === "platform",
              )}
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
      {tab === "sets" ? (
        <div className="mt-6 space-y-3">
          {filteredSets.length === 0 ? (
            <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
              No sets yet. Create one from the Templates tab.
            </p>
          ) : (
            filteredSets.map((row) => (
              <SetCard
                key={row.id}
                set={row}
                variant={variant}
                templates={templates}
                desks={desks}
                onResult={flash}
              />
            ))
          )}
        </div>
      ) : null}
      {tab === "shared-templates" ? (
        <div className="mt-6 space-y-3">
          {filteredSharedTemplates.length === 0 ? (
            <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
              Nothing shared with you yet. Another member can share a template
              by entering your email.
            </p>
          ) : (
            filteredSharedTemplates.map((row) => (
              <TemplateCard
                key={row.id}
                template={row}
                variant={variant}
                desks={desks}
                shared
                onResult={flash}
              />
            ))
          )}
        </div>
      ) : null}
      {tab === "shared-sets" ? (
        <div className="mt-6 space-y-3">
          {filteredSharedSets.length === 0 ? (
            <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
              No shared sets yet.
            </p>
          ) : (
            filteredSharedSets.map((row) => (
              <SetCard
                key={row.id}
                set={row}
                variant={variant}
                templates={templates}
                desks={desks}
                shared
                onResult={flash}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
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

function TemplateCard({
  template,
  variant,
  desks,
  shared = false,
  onResult,
}: {
  template: AutomationTemplate;
  variant: "account" | "admin";
  desks: DeskOption[];
  shared?: boolean;
  onResult: (result: TemplateActionResult) => void;
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [accountId, setAccountId] = useState(
    desks.find((desk) => desk.deskType === template.deskType)?.id ?? "",
  );
  const [symbol, setSymbol] = useState(
    template.recipe.kind === "cash_and_carry" ? "" : template.recipe.symbol,
  );
  const [publishName, setPublishName] = useState(template.name);
  const matchingDesks = desks.filter((desk) => desk.deskType === template.deskType);
  const canEdit =
    !shared && (variant === "admin" || template.visibility === "user");
  const platformReadOnly =
    shared || (variant === "account" && template.visibility === "platform");
  const canShare = !shared && template.visibility === "user";

  async function saveMeta() {
    const data = new FormData();
    data.set("templateId", template.id);
    data.set("templateName", name);
    data.set("templateDescription", description);
    onResult(await updateTemplateMetaAction(data));
  }

  async function remove() {
    if (!window.confirm(`Delete “${template.name}”?`)) {
      return;
    }
    const data = new FormData();
    data.set("templateId", template.id);
    onResult(await deleteTemplateAction(data));
  }

  async function apply() {
    const data = new FormData();
    data.set("templateId", template.id);
    data.set("accountId", accountId);
    if (symbol.trim()) {
      data.set("symbol", symbol.trim().toUpperCase());
    }
    const result = await applyTemplateAction(data);
    onResult(result);
  }

  async function publish() {
    const data = new FormData();
    data.set("templateId", template.id);
    data.set("templateName", publishName);
    data.set("templateDescription", description);
    onResult(await publishTemplateCopyAction(data));
  }

  async function removeShare() {
    const data = new FormData();
    data.set("templateId", template.id);
    onResult(await unshareTemplateAction(data));
  }

  return (
    <article className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
          {formatDeskType(template.deskType)} ·{" "}
          {template.visibility === "platform" ? "Platform" : "User"}
          {template.ownerEmail ? ` · ${template.ownerEmail}` : ""}
          {template.sharedByEmail
            ? ` · Shared by ${template.sharedByEmail}`
            : ""}
          {template.sharedAtMs
            ? ` · ${new Date(template.sharedAtMs).toISOString().slice(0, 10)}`
            : ""}
        </p>
        <p className="text-xs text-ink-muted">{recipePreview(template.recipe)}</p>
      </div>
      {platformReadOnly ? (
        <p className="mt-2 text-sm font-semibold text-ink">{template.name}</p>
      ) : (
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={`${fieldClass} font-semibold`}
        />
      )}
      {template.description || !platformReadOnly ? (
        platformReadOnly ? (
          <p className="mt-2 text-sm text-ink-muted">{template.description}</p>
        ) : (
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className={fieldClass}
          />
        )
      ) : null}
      {variant === "account" ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-ink-muted">
            Apply to desk
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className={fieldClass}
            >
              <option value="">Choose a desk</option>
              {matchingDesks.map((desk) => (
                <option key={desk.id} value={desk.id}>
                  {desk.name}
                </option>
              ))}
            </select>
          </label>
          {template.deskType === "dca" ? (
            <label className="text-xs text-ink-muted">
              Contract
              <input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                className={fieldClass}
              />
            </label>
          ) : null}
        </div>
      ) : null}
      {variant === "admin" && !shared && template.visibility === "user" ? (
        <label className="mt-3 block text-xs text-ink-muted">
          Publish copy as
          <input
            value={publishName}
            onChange={(event) => setPublishName(event.target.value)}
            className={fieldClass}
          />
        </label>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {canEdit && !platformReadOnly ? (
          <button type="button" onClick={() => void saveMeta()} className={primaryBtn}>
            Save
          </button>
        ) : null}
        {variant === "account" ? (
          <button
            type="button"
            disabled={!accountId}
            onClick={() => void apply()}
            className={primaryBtn}
          >
            Apply
          </button>
        ) : null}
        {variant === "admin" && !shared && template.visibility === "user" ? (
          <button type="button" onClick={() => void publish()} className={secondaryBtn}>
            Publish copy to platform
          </button>
        ) : null}
        {canEdit ? (
          <button type="button" onClick={() => void remove()} className={dangerBtn}>
            Delete
          </button>
        ) : null}
        {shared ? (
          <button
            type="button"
            onClick={() => void removeShare()}
            className={dangerBtn}
          >
            Remove
          </button>
        ) : null}
      </div>
      {canShare ? (
        <ShareControls
          kind="template"
          id={template.id}
          peers={template.sharedWith}
          onResult={onResult}
        />
      ) : null}
    </article>
  );
}

function SetCard({
  set,
  variant,
  templates,
  desks,
  shared = false,
  onResult,
}: {
  set: AutomationTemplateSet;
  variant: "account" | "admin";
  templates: AutomationTemplate[];
  desks: DeskOption[];
  shared?: boolean;
  onResult: (result: TemplateActionResult) => void;
}) {
  const [name, setName] = useState(set.name);
  const [description, setDescription] = useState(set.description ?? "");
  const allowed = templates.filter((row) => {
    if (row.deskType !== set.deskType) {
      return false;
    }
    if (set.visibility === "platform") {
      return row.visibility === "platform";
    }
    return row.visibility === "platform" || row.visibility === "user";
  });
  const [ids, setIds] = useState(set.items.map((item) => item.templateId));
  const [accountId, setAccountId] = useState(
    desks.find((desk) => desk.deskType === set.deskType)?.id ?? "",
  );
  const matchingDesks = desks.filter((desk) => desk.deskType === set.deskType);
  const platformReadOnly =
    shared || (variant === "account" && set.visibility === "platform");
  const canEdit = !shared && (variant === "admin" || set.visibility === "user");
  const canShare = !shared && set.visibility === "user";

  async function save() {
    const data = new FormData();
    data.set("setId", set.id);
    data.set("templateName", name);
    data.set("templateDescription", description);
    data.set("templateIds", ids.join(","));
    onResult(await updateTemplateSetAction(data));
  }

  async function remove() {
    if (!window.confirm(`Delete set “${set.name}”?`)) {
      return;
    }
    const data = new FormData();
    data.set("setId", set.id);
    onResult(await deleteTemplateSetAction(data));
  }

  async function apply() {
    const data = new FormData();
    data.set("setId", set.id);
    data.set("accountId", accountId);
    data.set("itemCount", String(set.items.length));
    set.items.forEach((item, index) => {
      data.set(`i${index}_templateId`, item.templateId);
    });
    onResult(await applyTemplateSetAction(data));
  }

  async function removeShare() {
    const data = new FormData();
    data.set("setId", set.id);
    onResult(await unshareSetAction(data));
  }

  return (
    <article className="rounded-card border border-line bg-surface p-4">
      <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
        {formatDeskType(set.deskType)} ·{" "}
        {set.visibility === "platform" ? "Platform" : "User"}
        {set.ownerEmail ? ` · ${set.ownerEmail}` : ""}
        {set.sharedByEmail ? ` · Shared by ${set.sharedByEmail}` : ""}
        {set.sharedAtMs
          ? ` · ${new Date(set.sharedAtMs).toISOString().slice(0, 10)}`
          : ""}
      </p>
      {platformReadOnly ? (
        <p className="mt-2 text-sm font-semibold text-ink">{set.name}</p>
      ) : (
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={`${fieldClass} font-semibold`}
        />
      )}
      {platformReadOnly ? (
        set.description ? (
          <p className="mt-2 text-sm text-ink-muted">{set.description}</p>
        ) : null
      ) : (
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          className={fieldClass}
        />
      )}
      <ul className="mt-2 space-y-1 text-sm text-ink-muted">
        {set.items.map((item) => (
          <li key={item.templateId}>{item.preview}</li>
        ))}
      </ul>
      {canEdit && !platformReadOnly ? (
        <div className="mt-3 space-y-1">
          {allowed.map((row) => (
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
            </label>
          ))}
        </div>
      ) : null}
      {variant === "account" ? (
        <label className="mt-3 block text-xs text-ink-muted">
          Apply to desk
          <select
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            className={fieldClass}
          >
            <option value="">Choose a desk</option>
            {matchingDesks.map((desk) => (
              <option key={desk.id} value={desk.id}>
                {desk.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {canEdit && !platformReadOnly ? (
          <button type="button" onClick={() => void save()} className={primaryBtn}>
            Save
          </button>
        ) : null}
        {variant === "account" ? (
          <button
            type="button"
            disabled={!accountId}
            onClick={() => void apply()}
            className={primaryBtn}
          >
            Apply
          </button>
        ) : null}
        {canEdit ? (
          <button type="button" onClick={() => void remove()} className={dangerBtn}>
            Delete
          </button>
        ) : null}
        {shared ? (
          <button
            type="button"
            onClick={() => void removeShare()}
            className={dangerBtn}
          >
            Remove
          </button>
        ) : null}
      </div>
      {canShare ? (
        <ShareControls
          kind="set"
          id={set.id}
          peers={set.sharedWith}
          onResult={onResult}
        />
      ) : null}
    </article>
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
  const deskTypes = useMemo(
    () =>
      Array.from(new Set(templates.map((row) => row.deskType))) as TemplateDeskType[],
    [templates],
  );
  const [deskType, setDeskType] = useState<TemplateDeskType>(deskTypes[0] ?? "dca");
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

  if (options.length === 0 && deskTypes.length === 0) {
    return null;
  }

  return (
    <article className="rounded-card border border-dashed border-line bg-canvas p-4">
      <p className="text-sm font-semibold text-ink">
        {visibility === "platform" ? "New platform set" : "New set"}
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
          {(["dca", "perps", "cash_and_carry"] as const)
            .filter((type) => templates.some((row) => row.deskType === type))
            .map((type) => (
              <option key={type} value={type}>
                {formatDeskType(type)}
              </option>
            ))}
        </select>
      </label>
      <div className="mt-2 space-y-1">
        {options.map((row) => (
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
        ))}
      </div>
      <button
        type="button"
        disabled={!name.trim() || ids.length === 0}
        onClick={() => void create()}
        className={`${primaryBtn} mt-3`}
      >
        Create set
      </button>
    </article>
  );
}
