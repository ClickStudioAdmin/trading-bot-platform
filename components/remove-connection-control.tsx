"use client";

import { useRef, useState } from "react";
import { AnchoredPanel } from "@/components/anchored-panel";
import { IconTrash } from "@/components/icons";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { TABLE_BTN_ICON, TableIconAction } from "@/components/table-chrome";
import { removeExchangeConnection } from "@/lib/exchanges/actions";

export function RemoveConnectionControl({
  connectionId,
  blockedMessage,
}: {
  connectionId: string;
  blockedMessage: string | null;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <TableIconAction
        ref={buttonRef}
        danger
        label="Remove"
        detail="Remove this exchange key."
        onClick={() => setOpen((current) => !current)}
      >
        <IconTrash {...TABLE_BTN_ICON} />
      </TableIconAction>
      <AnchoredPanel
        open={open}
        onClose={() => setOpen(false)}
        buttonRef={buttonRef}
      >
        {blockedMessage ? (
          <p className="text-hint text-ink-faint">{blockedMessage}.</p>
        ) : (
          <>
            <p className="text-hint text-ink-faint">
              Remove this connection? You can add the key again later.
            </p>
            <form action={removeExchangeConnection} className="mt-3">
              <input type="hidden" name="connectionId" value={connectionId} />
              <PendingSubmitButton
                pendingLabel="Removing"
                successKey={`exchange-remove-${connectionId}`}
                className="w-full rounded-control bg-danger px-3 py-1.5 text-sm font-medium text-ink"
              >
                Remove connection
              </PendingSubmitButton>
            </form>
          </>
        )}
      </AnchoredPanel>
    </>
  );
}
