"use client";

import { useState } from "react";
import { BotButtonLead, botBtnIcon } from "@/components/bot-form-chrome";
import { ExchangeConnectForm } from "@/components/exchange-connect-form";
import { IconPlus } from "@/components/icons";
import { TABLE_BTN_ICON, TableLabelButton } from "@/components/table-chrome";
import { Modal } from "@/components/template-modals";
import type { BybitAgreementKind } from "@/lib/exchanges/agreement";
import type { VenueDefinition } from "@/lib/exchanges/venues";

export function ExchangeConnectModal({
  venues,
  next,
  trigger = "link",
  enabledKinds = [],
}: {
  venues: VenueDefinition[];
  next?: string;
  trigger?: "link" | "toolbar";
  enabledKinds?: readonly BybitAgreementKind[];
}) {
  const [open, setOpen] = useState(false);
  if (venues.length === 0) {
    return null;
  }
  const title =
    trigger === "toolbar"
      ? "Add New Exchange Connection"
      : "Add a connection";

  return (
    <>
      {trigger === "toolbar" ? (
        <TableLabelButton
          variant="primary"
          icon={<IconPlus {...TABLE_BTN_ICON} />}
          onClick={() => setOpen(true)}
        >
          Add New Exchange Connection
        </TableLabelButton>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-strong"
        >
          <BotButtonLead icon={<IconPlus {...botBtnIcon} />}>
            Add a connection
          </BotButtonLead>
        </button>
      )}
      {open ? (
        <Modal title={title} onClose={() => setOpen(false)}>
          <div className="mt-4">
            <ExchangeConnectForm
              venues={venues}
              next={next}
              compact
              hideTitle
              enabledKinds={enabledKinds}
            />
          </div>
        </Modal>
      ) : null}
    </>
  );
}
