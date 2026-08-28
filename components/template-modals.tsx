"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PanelCloseButton } from "@/components/panel-close-button";
import {
  applyTemplateAction,
  applyTemplateSetAction,
  saveDcaAsTemplateAction,
  savePaperAsTemplateAction,
  savePerpsAsTemplateAction,
  type TemplateActionResult,
} from "@/lib/templates/actions";
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

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
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
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card border border-line bg-surface-raised p-5"
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
}: {
  isAdmin: boolean;
  defaultName: string;
  buildForm: () => FormData;
  kind: TemplateDeskType;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<TemplateActionResult | null>(null);
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState(false);
  const [replace, setReplace] = useState(false);

  async function onSave() {
    setPending(true);
    const data = buildForm();
    data.set("templateName", name);
    data.set("templateDescription", description);
    data.set("visibility", platform ? "platform" : "user");
    if (replace) {
      data.set("replaceExisting", "1");
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
    }
    if (next.code === "name_taken") {
      setReplace(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setName(defaultName);
          setDescription("");
          setPlatform(false);
          setReplace(false);
          setResult(null);
          setOpen(true);
        }}
        className="shrink-0 rounded-control px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink"
      >
        Save as template
      </button>
      {isAdmin ? (
        <button
          type="button"
          onClick={() => {
            setName(defaultName);
            setDescription("");
            setPlatform(true);
            setReplace(false);
            setResult(null);
            setOpen(true);
          }}
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
              disabled={pending}
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

export function DeskTemplateBar({
  deskType,
  accountId,
  templates,
  sets,
}: {
  deskType: TemplateDeskType;
  accountId: string;
  templates: TemplateSummary[];
  sets: AutomationTemplateSet[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ApplyTemplateButton
        deskType={deskType}
        accountId={accountId}
        templates={templates}
      />
      {sets.length > 0 ? (
        <ApplySetButton
          deskType={deskType}
          accountId={accountId}
          sets={sets}
        />
      ) : null}
    </div>
  );
}

function ApplyTemplateButton({
  deskType,
  accountId,
  templates,
}: {
  deskType: TemplateDeskType;
  accountId: string;
  templates: TemplateSummary[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TemplateSummary | null>(null);
  const [symbol, setSymbol] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<TemplateActionResult | null>(null);
  const mine = templates.filter((row) => row.visibility === "user");
  const platform = templates.filter((row) => row.visibility === "platform");

  async function onApply(skip = false) {
    if (!selected) {
      return;
    }
    setPending(true);
    const data = new FormData();
    data.set("templateId", selected.id);
    data.set("accountId", accountId);
    if (symbol.trim()) {
      data.set("symbol", symbol.trim().toUpperCase());
    }
    if (skip) {
      data.set("skip", "1");
    }
    const next = await applyTemplateAction(data);
    setResult(next);
    setPending(false);
    if (next.ok) {
      setOpen(false);
    }
    if (next.code === "symbol_taken") {
      setSymbol(next.symbol ?? "");
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={secondaryBtn}>
        From template
      </button>
      {open ? (
        <Modal title="From template" onClose={() => setOpen(false)}>
          <p className="mt-1 text-sm text-ink-muted">
            Creates an idle or disabled recipe on this desk. Nothing is armed.
          </p>
          <TemplatePicker
            platform={platform}
            mine={mine}
            selectedId={selected?.id ?? ""}
            onSelect={(row) => {
              setSelected(row);
              setResult(null);
              setSymbol("");
            }}
          />
          {deskType === "dca" && selected ? (
            <label className="mt-3 block text-xs text-ink-muted">
              Contract
              <input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                placeholder="Leave blank to use the template contract"
                className={fieldClass}
              />
            </label>
          ) : null}
          {result?.code === "symbol_taken" ? (
            <p className="mt-3 text-sm text-warning">
              A playbook already covers {result.symbol}. Pick another contract
              or skip.
            </p>
          ) : null}
          <ResultNote result={result?.code === "symbol_taken" ? null : result} />
          <div className="mt-4 flex justify-end gap-2">
            {result?.code === "symbol_taken" ? (
              <button
                type="button"
                onClick={() => void onApply(true)}
                className={secondaryBtn}
              >
                Skip
              </button>
            ) : null}
            <button type="button" onClick={() => setOpen(false)} className={secondaryBtn}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!selected || pending}
              onClick={() => void onApply(false)}
              className={primaryBtn}
            >
              {pending ? "Applying…" : "Apply"}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function ApplySetButton({
  deskType,
  accountId,
  sets,
}: {
  deskType: TemplateDeskType;
  accountId: string;
  sets: AutomationTemplateSet[];
}) {
  const [open, setOpen] = useState(false);
  const [setId, setSetId] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<TemplateActionResult | null>(null);
  const [symbols, setSymbols] = useState<Record<string, string>>({});
  const [skips, setSkips] = useState<Record<string, boolean>>({});
  const selected = sets.find((row) => row.id === setId) ?? null;
  const mine = sets.filter((row) => row.visibility === "user");
  const platform = sets.filter((row) => row.visibility === "platform");

  async function onApply() {
    if (!selected) {
      return;
    }
    setPending(true);
    const data = new FormData();
    data.set("setId", selected.id);
    data.set("accountId", accountId);
    data.set("itemCount", String(selected.items.length));
    selected.items.forEach((item, index) => {
      data.set(`i${index}_templateId`, item.templateId);
      if (skips[item.templateId]) {
        data.set(`i${index}_skip`, "1");
      }
      const symbol = symbols[item.templateId]?.trim();
      if (symbol) {
        data.set(`i${index}_symbol`, symbol.toUpperCase());
      }
    });
    const next = await applyTemplateSetAction(data);
    setResult(next);
    setPending(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={secondaryBtn}>
        From set
      </button>
      {open ? (
        <Modal title="From set" onClose={() => setOpen(false)}>
          <p className="mt-1 text-sm text-ink-muted">
            Applies each template. Failures are listed; successes stay.
          </p>
          <label className="mt-3 block text-xs text-ink-muted">
            Set
            <select
              value={setId}
              onChange={(event) => {
                setSetId(event.target.value);
                setResult(null);
              }}
              className={fieldClass}
            >
              <option value="">Choose a set</option>
              {platform.length > 0 ? (
                <optgroup label="Platform">
                  {platform.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {mine.length > 0 ? (
                <optgroup label="My sets">
                  {mine.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
          {selected ? (
            <ul className="mt-3 space-y-2">
              {selected.items.map((item) => (
                <li
                  key={item.templateId}
                  className="rounded-card border border-line bg-canvas px-3 py-2"
                >
                  <p className="text-sm text-ink">{item.name}</p>
                  <p className="text-xs text-ink-muted">{item.preview}</p>
                  {deskType === "dca" ? (
                    <label className="mt-2 block text-xs text-ink-muted">
                      Contract
                      <input
                        value={symbols[item.templateId] ?? ""}
                        onChange={(event) =>
                          setSymbols((current) => ({
                            ...current,
                            [item.templateId]: event.target.value,
                          }))
                        }
                        placeholder="Template contract"
                        className={fieldClass}
                      />
                    </label>
                  ) : null}
                  <label className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      checked={Boolean(skips[item.templateId])}
                      onChange={(event) =>
                        setSkips((current) => ({
                          ...current,
                          [item.templateId]: event.target.checked,
                        }))
                      }
                    />
                    Skip
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
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
                disabled={!selected || pending}
                onClick={() => void onApply()}
                className={primaryBtn}
              >
                {pending ? "Applying…" : "Apply set"}
              </button>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function TemplatePicker({
  platform,
  mine,
  selectedId,
  onSelect,
}: {
  platform: TemplateSummary[];
  mine: TemplateSummary[];
  selectedId: string;
  onSelect: (row: TemplateSummary) => void;
}) {
  return (
    <div className="mt-3 space-y-3">
      {platform.length > 0 ? (
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
            Platform
          </p>
          <ul className="mt-1 space-y-1">
            {platform.map((row) => (
              <PickerRow
                key={row.id}
                row={row}
                selected={selectedId === row.id}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
          My templates
        </p>
        {mine.length === 0 ? (
          <p className="mt-1 text-sm text-ink-muted">
            None yet. Save a recipe as a template from a card.
          </p>
        ) : (
          <ul className="mt-1 space-y-1">
            {mine.map((row) => (
              <PickerRow
                key={row.id}
                row={row}
                selected={selectedId === row.id}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PickerRow({
  row,
  selected,
  onSelect,
}: {
  row: TemplateSummary;
  selected: boolean;
  onSelect: (row: TemplateSummary) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(row)}
        className={`w-full rounded-control border px-3 py-2 text-left ${
          selected
            ? "border-accent bg-surface"
            : "border-line bg-canvas hover:border-line-strong"
        }`}
      >
        <span className="block text-sm text-ink">{row.name}</span>
        <span className="block text-xs text-ink-muted">
          {row.preview}
          {row.description ? ` · ${row.description}` : ""}
        </span>
      </button>
    </li>
  );
}

export function deskTypeLabel(deskType: TemplateDeskType): string {
  return formatDeskType(deskType);
}
