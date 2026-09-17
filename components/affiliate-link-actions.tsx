"use client";

import { useState } from "react";
import { AffiliateArchiveButton } from "@/components/affiliate-archive-button";
import { IconPencil } from "@/components/icons";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { TABLE_BTN_ICON, TableIconAction } from "@/components/table-chrome";
import { Modal } from "@/components/template-modals";
import { renameAffiliateLinkAction } from "@/lib/membership/affiliate-actions";
import { AFFILIATE_LINK_NAME_MAX } from "@/lib/membership/affiliate";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";

export function AffiliateLinkActions({
  id,
  name,
  canArchive,
}: {
  id: string;
  name: string;
  canArchive: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <TableIconAction
        label="Rename"
        detail="Change this URL's name."
        onClick={() => setOpen(true)}
      >
        <IconPencil {...TABLE_BTN_ICON} />
      </TableIconAction>
      {canArchive ? (
        <AffiliateArchiveButton kind="link" id={id} name={name} />
      ) : null}
      {open ? (
        <Modal title="Rename URL" onClose={() => setOpen(false)} elevated>
          <form action={renameAffiliateLinkAction} className="mt-4 space-y-3">
            <input type="hidden" name="linkId" value={id} />
            <label className="block text-sm text-ink">
              Name
              <input
                name="name"
                required
                maxLength={AFFILIATE_LINK_NAME_MAX}
                defaultValue={name}
                className={BILLING_FIELD_CLASS}
              />
            </label>
            <PendingSubmitButton
              pendingLabel="Saving…"
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              Save name
            </PendingSubmitButton>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
