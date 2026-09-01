"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyDeskGuardsFields } from "@/components/copy-desk-guards-fields";
import { DeskFormFlash, StayOnPageForm } from "@/components/stay-on-page-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Modal } from "@/components/template-modals";
import {
  formatAccountModeChoice,
  formatDeskType,
  formatDeskVenueCaption,
} from "@/lib/accounts/model";
import { createCopyDeskAction } from "@/lib/copy/actions";
import { formatCopyPaperStartingUsdt } from "@/lib/copy/decide";
import {
  formatConnectionSummary,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import { connectionFitsDesk, getVenue } from "@/lib/exchanges/venues";
import type { DeskType } from "@/lib/accounts/model";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function CopyFollowButton({
  parentAccountId,
  deskName,
  deskType,
  venue,
  venueEnvironment,
  connections,
  following,
  defaultOpen = false,
  className = "rounded-control bg-accent-strong px-4 py-2 text-center text-sm font-medium text-ink",
}: {
  parentAccountId: string;
  deskName: string;
  deskType: DeskType;
  venue: string;
  venueEnvironment: string | null;
  connections: ExchangeConnection[];
  following?: boolean;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (following) {
    return (
      <p className="whitespace-nowrap rounded-control border border-line px-4 py-2 text-center text-sm text-ink-muted">
        Following
      </p>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        Copy
      </button>
      {open ? (
        <CopyFollowModal
          parentAccountId={parentAccountId}
          deskName={deskName}
          deskType={deskType}
          venue={venue}
          venueEnvironment={venueEnvironment}
          connections={connections}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function CopyFollowModal({
  parentAccountId,
  deskName,
  deskType,
  venue,
  venueEnvironment,
  connections,
  onClose,
}: {
  parentAccountId: string;
  deskName: string;
  deskType: DeskType;
  venue: string;
  venueEnvironment: string | null;
  connections: ExchangeConnection[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [followed, setFollowed] = useState(false);
  const venueDef = getVenue(venue);
  const stamp = `${formatDeskType(deskType)} · ${formatDeskVenueCaption({
    venue,
    venueEnvironment,
  })}${venueDef ? ` · ${venueDef.label}` : ""}`;
  const matching = connections.filter(
    (row) =>
      row.status === "active" &&
      connectionFitsDesk({
        deskVenue: venue,
        deskEnvironment: venueEnvironment,
        connectionVenue: row.venue,
        connectionEnvironment: row.environment,
      }).ok,
  );

  return (
    <Modal title="Copy desk" onClose={onClose} size="xl">
      <p className="mt-1 text-sm text-ink-muted">
        Type and venue are stamped from {deskName}. Pick Paper or Live, then
        set guards. Recipes and keys stay on the parent.
      </p>
      {followed ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-success">
            You are following this desk. Close this window, or open the copy
            desk from the sidebar.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-control border border-line px-4 py-2 text-sm text-ink hover:bg-surface"
          >
            Close
          </button>
        </div>
      ) : (
        <StayOnPageForm
          action={createCopyDeskAction}
          onResult={(result) => {
            if (!result.ok) {
              return;
            }
            if (result.href) {
              router.push(result.href);
              return;
            }
            setFollowed(true);
            router.refresh();
          }}
          className="mt-4 space-y-4"
        >
          <input type="hidden" name="parentAccountId" value={parentAccountId} />
          <DeskFormFlash />
          <div className="grid items-start gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
            <div className="space-y-4">
              <p className="text-xs text-ink-faint">{stamp}</p>
              <label className="block text-sm text-ink">
                Desk name
                <input
                  type="text"
                  name="name"
                  required
                  maxLength={40}
                  defaultValue={`Copy of ${deskName}`.slice(0, 40)}
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm text-ink">
                Mode
                <select
                  name="mode"
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value === "live" ? "live" : "paper")
                  }
                  className={fieldClass}
                >
                  <option value="paper">
                    {formatAccountModeChoice("paper")}
                  </option>
                  <option value="live">
                    {formatAccountModeChoice("live")}
                  </option>
                </select>
              </label>
              {mode === "live" ? (
                matching.length > 0 ? (
                  <label className="block text-sm text-ink">
                    Exchange connection
                    <select name="exchangeConnectionId" className={fieldClass}>
                      <option value="">Bind later in Desk Settings</option>
                      {matching.map((row) => (
                        <option key={row.id} value={row.id}>
                          {formatConnectionSummary(row)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="text-sm text-ink-muted">
                    No matching key on this login. Bind later in Desk Settings.
                  </p>
                )
              ) : (
                <p className="text-sm text-ink-muted">
                  Paper starts at {formatCopyPaperStartingUsdt()}. Copies size
                  from that plus realized and unrealized. Venue is stamped from
                  the parent.
                </p>
              )}
            </div>
            <CopyDeskGuardsFields paper={mode === "paper"} showReduceOnly={false} />
          </div>
          <div className="space-y-3 border-t border-line pt-4">
            <PendingSubmitButton
              pendingLabel="Copying…"
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              Copy
            </PendingSubmitButton>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" name="goToDesk" className="mt-0.5" />
              <span>Go to Copy Desk</span>
            </label>
          </div>
        </StayOnPageForm>
      )}
    </Modal>
  );
}
