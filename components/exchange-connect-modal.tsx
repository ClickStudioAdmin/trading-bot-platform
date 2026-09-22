"use client";

import { useState } from "react";
import { BotButtonLead, botBtnIcon } from "@/components/bot-form-chrome";
import { ExchangeConnectForm } from "@/components/exchange-connect-form";
import { IconPlus } from "@/components/icons";
import { Modal } from "@/components/template-modals";
import type { VenueDefinition } from "@/lib/exchanges/venues";

export function ExchangeConnectModal({
  venues,
  next,
}: {
  venues: VenueDefinition[];
  next?: string;
}) {
  const [open, setOpen] = useState(false);
  if (venues.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-strong"
      >
        <BotButtonLead icon={<IconPlus {...botBtnIcon} />}>
          Add a connection
        </BotButtonLead>
      </button>
      {open ? (
        <Modal title="Add a connection" onClose={() => setOpen(false)}>
          <div className="mt-4">
            <ExchangeConnectForm
              venues={venues}
              next={next}
              compact
              hideTitle
            />
          </div>
        </Modal>
      ) : null}
    </>
  );
}
