"use client";

import { useMemo, useState } from "react";
import { formatDeskType } from "@/lib/accounts/model";
import {
  applyTemplateAction,
  applyTemplateSetAction,
  createTemplateSetAction,
  deleteTemplateAction,
  deleteTemplateSetAction,
  publishTemplateCopyAction,
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

export function TemplatesLibrary({
  variant,
  templates,
  sets,
  desks,
}: {
  variant: "account" | "admin";
  templates: AutomationTemplate[];
  sets: AutomationTemplateSet[];
  desks: DeskOption[];
}) {
  const [tab, setTab] = useState<"templates" | "sets">("templates");
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

  function flash(result: TemplateActionResult) {
    if (result.ok) {
      setError(null);
      setMessage("Saved.");
    } else {
      setMessage(null);
      setError(result.error ?? "That did not work.");
    }
  }

  return (
    <div>
      <nav className="mt-5 flex border-b border-line">
        <TabButton selected={tab === "templates"} onClick={() => setTab("templates")}>
          Templates
        </TabButton>
        <TabButton selected={tab === "sets"} onClick={() => setTab("sets")}>
          Sets
        </TabButton>
      </nav>
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
        {variant === "admin" ? (
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
      ) : (
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
      )}
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
  onResult,
}: {
  template: AutomationTemplate;
  variant: "account" | "admin";
  desks: DeskOption[];
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
    variant === "admin" || template.visibility === "user";
  const platformReadOnly = variant === "account" && template.visibility === "platform";

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

  return (
    <article className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
          {formatDeskType(template.deskType)} ·{" "}
          {template.visibility === "platform" ? "Platform" : "User"}
          {template.ownerEmail ? ` · ${template.ownerEmail}` : ""}
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
        {variant === "admin" && template.visibility === "user" ? (
          <button type="button" onClick={() => void publish()} className={secondaryBtn}>
            Publish copy to platform
          </button>
        ) : null}
        {canEdit ? (
          <button type="button" onClick={() => void remove()} className={dangerBtn}>
            Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}

function SetCard({
  set,
  variant,
  templates,
  desks,
  onResult,
}: {
  set: AutomationTemplateSet;
  variant: "account" | "admin";
  templates: AutomationTemplate[];
  desks: DeskOption[];
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
  const platformReadOnly = variant === "account" && set.visibility === "platform";
  const canEdit = variant === "admin" || set.visibility === "user";

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

  return (
    <article className="rounded-card border border-line bg-surface p-4">
      <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
        {formatDeskType(set.deskType)} ·{" "}
        {set.visibility === "platform" ? "Platform" : "User"}
        {set.ownerEmail ? ` · ${set.ownerEmail}` : ""}
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
      </div>
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
