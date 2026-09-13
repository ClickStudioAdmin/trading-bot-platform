"use client";

import { useConfirmDialog } from "@/components/confirm-modal";
import {
  archiveAffiliateCampaignAction,
  archiveAffiliateLinkAction,
} from "@/lib/membership/affiliate-actions";

const ghost =
  "rounded-control px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-raised hover:text-ink";

export function AffiliateArchiveButton({
  kind,
  id,
  name,
}: {
  kind: "campaign" | "link";
  id: string;
  name: string;
}) {
  const { confirm, dialog } = useConfirmDialog();

  async function onArchive() {
    const ok = await confirm({
      title: kind === "campaign" ? "Archive this campaign?" : "Archive this link?",
      message:
        kind === "campaign"
          ? `${name} leaves the picker. Existing links and stats keep this campaign. Old /r/ URLs still work.`
          : `${name} leaves your active list. The /r/ URL still works and past attributions stay on this link.`,
      confirmLabel: "Archive",
    });
    if (!ok) {
      return;
    }
    const data = new FormData();
    if (kind === "campaign") {
      data.set("campaignId", id);
      await archiveAffiliateCampaignAction(data);
      return;
    }
    data.set("linkId", id);
    await archiveAffiliateLinkAction(data);
  }

  return (
    <>
      {dialog}
      <button type="button" className={ghost} onClick={() => void onArchive()}>
        Archive
      </button>
    </>
  );
}
