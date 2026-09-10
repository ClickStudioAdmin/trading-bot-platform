"use client";

import { useRef, type FormEvent } from "react";
import { useConfirmDialog } from "@/components/confirm-modal";
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
  const formRef = useRef<HTMLFormElement>(null);
  const skipConfirm = useRef(false);
  const { confirm, dialog } = useConfirmDialog();
  const unfollowTitle =
    unfollowBlock === "open"
      ? COPY_UNFOLLOW_OPEN_TRADES
      : unfollowBlock === "last"
        ? COPY_UNFOLLOW_LAST_DESK
        : "Unfollow and delete this copy desk";

  async function onUnfollow(event: FormEvent<HTMLFormElement>) {
    if (skipConfirm.current) {
      skipConfirm.current = false;
      return;
    }
    event.preventDefault();
    const ok = await confirm({
      title: "Unfollow this desk?",
      message:
        "Your copy desk will be deleted. A private invite stays so you can follow again.",
      confirmLabel: "Unfollow",
      danger: true,
    });
    if (!ok) {
      return;
    }
    skipConfirm.current = true;
    formRef.current?.requestSubmit();
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
      <form
        ref={formRef}
        action={unfollowDeskCopyAction}
        onSubmit={(event) => void onUnfollow(event)}
      >
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
      {dialog}
    </div>
  );
}
