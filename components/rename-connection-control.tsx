"use client";

import { useRef, useState } from "react";
import { AnchoredPanel } from "@/components/anchored-panel";
import { IconPencil } from "@/components/icons";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { TABLE_BTN_ICON, TableIconAction } from "@/components/table-chrome";
import { renameExchangeConnection } from "@/lib/exchanges/actions";

const fieldClass =
  "mt-1 w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function RenameConnectionControl({
  connectionId,
  label,
}: {
  connectionId: string;
  label: string | null;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <TableIconAction
        ref={buttonRef}
        label="Rename"
        detail="Change this connection's label."
        onClick={() => setOpen((current) => !current)}
      >
        <IconPencil {...TABLE_BTN_ICON} />
      </TableIconAction>
      <AnchoredPanel
        open={open}
        onClose={() => setOpen(false)}
        buttonRef={buttonRef}
      >
        <p className="text-hint text-ink-faint">
          Change the label. Bound desks stay the same.
        </p>
        <form action={renameExchangeConnection} className="mt-3 space-y-3">
          <input type="hidden" name="connectionId" value={connectionId} />
          <label className="block text-xs text-ink-muted">
            Label (optional)
            <input
              name="label"
              maxLength={40}
              defaultValue={label ?? ""}
              className={fieldClass}
            />
          </label>
          <PendingSubmitButton
            pendingLabel="Saving"
            successKey={`exchange-rename-${connectionId}`}
            className="w-full rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
          >
            Save label
          </PendingSubmitButton>
        </form>
      </AnchoredPanel>
    </>
  );
}
