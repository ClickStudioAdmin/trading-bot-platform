"use client";

import { useState } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { unfollowDeskCopyAction } from "@/lib/copy/actions";
import {
  COPY_UNFOLLOW_CONFIRM,
  COPY_UNFOLLOW_LAST_DESK,
  COPY_UNFOLLOW_OPEN_TRADES,
} from "@/lib/copy/model";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none";

export function CopyUnfollowCard({
  canUnfollow,
  unfollowBlock,
}: {
  canUnfollow: boolean;
  unfollowBlock: "open" | "last" | null;
}) {
  const [confirm, setConfirm] = useState("");
  const matched = confirm.trim() === COPY_UNFOLLOW_CONFIRM;

  return (
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
  );
}
