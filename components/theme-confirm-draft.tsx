"use client";

import {
  PanelCloseButton,
  PanelCloseReserve,
} from "@/components/panel-close-button";

const cancelBtn =
  "rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong";
const dangerBtn =
  "rounded-control bg-danger px-4 py-2 text-sm font-medium text-ink hover:opacity-90";
const primaryBtn =
  "rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent";

export function ThemeConfirmDraft() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ConfirmSample
        kind="Danger"
        title="Remove Bybit testing 3 and its closed history?"
        helper="This cannot be undone."
        confirm="Delete desk"
        confirmClass={dangerBtn}
      />
      <ConfirmSample
        kind="Primary"
        title="Publish this template?"
        helper="It shows in the platform library."
        confirm="Publish"
        confirmClass={primaryBtn}
      />
    </div>
  );
}

function ConfirmSample({
  kind,
  title,
  helper,
  confirm,
  confirmClass,
}: {
  kind: string;
  title: string;
  helper: string;
  confirm: string;
  confirmClass: string;
}) {
  return (
    <div>
      <p className="mb-3 text-xs uppercase tracking-[0.12em] text-ink-faint">
        {kind}
      </p>
      <div
        role="group"
        aria-label={`${kind} confirm`}
        className="relative rounded-card border border-line bg-surface-raised p-5"
      >
        <PanelCloseButton onClick={() => {}} />
        <h2 className="min-w-0 text-lg font-semibold text-ink">
          <PanelCloseReserve size="modal" />
          {title}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">{helper}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={cancelBtn}>
            Cancel
          </button>
          <button type="button" className={confirmClass}>
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
