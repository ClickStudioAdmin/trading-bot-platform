"use client";

import { useConfirmDialog } from "@/components/confirm-modal";
import { IconArchive } from "@/components/icons";
import { TABLE_BTN_ICON, TableIconAction } from "@/components/table-chrome";
import {
  archiveAffiliateCampaignAction,
  archiveAffiliateLinkAction,
} from "@/lib/membership/affiliate-actions";

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
      title: kind === "campaign" ? "Archive this campaign?" : "Archive this URL?",
      message:
        kind === "campaign"
          ? `${name} leaves the picker. Existing URLs and stats keep this campaign. Old /r/ URLs still work.`
          : `${name} leaves your active list. The /r/ URL still works and past attributions stay on this URL.`,
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
      <TableIconAction
        label="Archive"
        detail={
          kind === "campaign"
            ? "Hide this campaign from the picker."
            : "Hide this URL from your active list."
        }
        onClick={() => void onArchive()}
      >
        <IconArchive {...TABLE_BTN_ICON} />
      </TableIconAction>
    </>
  );
}
