"use client";

import type { FormEvent } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { pauseDeskCopyAction, unfollowDeskCopyAction } from "@/lib/copy/actions";
import {
  COPY_UNFOLLOW_LAST_DESK,
  COPY_UNFOLLOW_OPEN_TRADES,
} from "@/lib/copy/model";

export function CopyDeskHeaderActions({
  paused,
  next,
  unfollowBlock,
}: {
  paused: boolean;
  next: string;
  unfollowBlock: "open" | "last" | null;
}) {
  const unfollowTitle =
    unfollowBlock === "open"
      ? COPY_UNFOLLOW_OPEN_TRADES
      : unfollowBlock === "last"
        ? COPY_UNFOLLOW_LAST_DESK
        : "Unfollow and delete this copy desk";

  function onUnfollow(event: FormEvent<HTMLFormElement>) {
    if (
      !window.confirm(
        "Unfollow this desk? Your copy desk will be deleted.",
      )
    ) {
      event.preventDefault();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={pauseDeskCopyAction}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="paused" value={paused ? "0" : "1"} />
        <PendingSubmitButton
          pendingLabel={paused ? "Resuming…" : "Pausing…"}
          successKey="copy-pause"
          className="rounded-control border border-line px-3 py-1.5 text-sm text-ink hover:bg-surface-raised"
        >
          {paused ? "Resume" : "Pause"}
        </PendingSubmitButton>
      </form>
      <form action={unfollowDeskCopyAction} onSubmit={onUnfollow}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="confirm" value="1" />
        <PendingSubmitButton
          pendingLabel="Unfollowing…"
          successKey="copy-unfollow"
          disabled={unfollowBlock != null}
          title={unfollowTitle}
          className="rounded-control border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
        >
          Unfollow
        </PendingSubmitButton>
      </form>
    </div>
  );
}
