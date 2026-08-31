"use client";

import { useState } from "react";
import { CopySizeFields } from "@/components/copy-size-fields";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  saveDeskCopyFollowerSettingsAction,
  unfollowDeskCopyAction,
} from "@/lib/copy/actions";
import {
  COPY_UNFOLLOW_CONFIRM,
  COPY_UNFOLLOW_LAST_DESK,
  COPY_UNFOLLOW_OPEN_TRADES,
} from "@/lib/copy/model";
import type { DeskCopySettings } from "@/lib/copy/model";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none";

export function CopyFollowerGuardsCard({
  settings,
  canUnfollow,
  unfollowBlock,
}: {
  settings: DeskCopySettings;
  canUnfollow: boolean;
  unfollowBlock: "open" | "last" | null;
}) {
  const [confirm, setConfirm] = useState("");
  const matched = confirm.trim() === COPY_UNFOLLOW_CONFIRM;

  return (
    <div className="space-y-4 rounded-card border border-line bg-surface p-5">
      <form action={saveDeskCopyFollowerSettingsAction} className="space-y-4">
        <div>
          <p className="text-sm text-ink">Copy guards</p>
          <p className="mt-1 text-xs text-ink-muted">
            Empty caps mean no extra cap. Desk risk caps and reduce-only
            still win. Flatten on breach starts with the copy engine.
          </p>
        </div>
        <CopySizeFields
          defaultMode={settings.sizeMode}
          defaultPercent={
            settings.sizePercent == null ? "" : String(settings.sizePercent)
          }
          defaultBookUsdt={
            settings.sizeBookUsdt == null ? "" : String(settings.sizeBookUsdt)
          }
        />
        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="paused"
            defaultChecked={settings.paused}
            className="mt-0.5"
          />
          <span>
            Pause copying
            <span className="mt-1 block text-xs text-ink-muted">
              Stops new copied entries. Open rows stay. Close All still works.
            </span>
          </span>
        </label>
        <label className="block text-sm text-ink">
          Max daily loss
          <span className="relative mt-1 block">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
              $
            </span>
            <GroupedNumberInput
              name="maxDailyLossUsdt"
              defaultValue={
                settings.maxDailyLossUsdt == null
                  ? ""
                  : String(settings.maxDailyLossUsdt)
              }
              allowDecimal
              placeholder="No cap"
              ariaLabel="Max daily loss"
              className="w-full rounded-control border border-line bg-surface-raised py-2 pr-3 pl-7 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
            />
          </span>
        </label>
        <label className="block text-sm text-ink">
          Max open notional
          <span className="relative mt-1 block">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
              $
            </span>
            <GroupedNumberInput
              name="maxOpenNotionalUsdt"
              defaultValue={
                settings.maxOpenNotionalUsdt == null
                  ? ""
                  : String(settings.maxOpenNotionalUsdt)
              }
              allowDecimal
              placeholder="No cap"
              ariaLabel="Max open notional"
              className="w-full rounded-control border border-line bg-surface-raised py-2 pr-3 pl-7 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
            />
          </span>
        </label>
        <PendingSubmitButton
          pendingLabel="Saving…"
          successKey="save-copy-guards"
          className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          Save copy guards
        </PendingSubmitButton>
      </form>
      <div className="space-y-3 border-t border-line pt-4">
        <p className="text-sm text-ink">Unfollow</p>
        <p className="text-xs text-ink-muted">
          Stops following this trader, revokes your grant, and deletes this
          copy desk. Close leftover trades first.
        </p>
        {unfollowBlock === "open" ? (
          <p className="text-sm text-warning">{COPY_UNFOLLOW_OPEN_TRADES}</p>
        ) : null}
        {unfollowBlock === "last" ? (
          <p className="text-sm text-warning">{COPY_UNFOLLOW_LAST_DESK}</p>
        ) : null}
        <form action={unfollowDeskCopyAction} className="space-y-3">
          <label className="block text-sm text-ink">
            Type {COPY_UNFOLLOW_CONFIRM} to confirm
            <input
              name="confirm"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="off"
              className={fieldClass}
            />
          </label>
          <PendingSubmitButton
            pendingLabel="Unfollowing…"
            successKey="copy-unfollow"
            disabled={!canUnfollow || !matched}
            className="rounded-control border border-danger/40 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            Unfollow and delete desk
          </PendingSubmitButton>
        </form>
      </div>
    </div>
  );
}
