"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppCheck } from "@/components/app-check";
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
import { AppSelect } from "@/components/app-select";
import { useDeskTypeAccess } from "@/components/desk-type-access";
import { useQuotaAccess } from "@/components/quota-access";
import {
  copyDeskPlanNotices,
  deskTypeAccessFor,
  quotaAccessFor,
  quotaKeyForDesk,
  type CopyDeskPlanNotice,
} from "@/lib/membership/entitlements";
import { BotButtonLead, botBtnIcon } from "@/components/bot-form-chrome";
import { IconCopyTrading } from "@/components/icons";
import { DeskTypeRejectBanner } from "@/components/desk-type-reject";
import { useCopyGateAccess } from "@/components/copy-gate-access";
import { followClickDenial } from "@/lib/membership/entitlements";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function CopyFollowButton({
  parentAccountId,
  deskName,
  deskType,
  venue,
  venueEnvironment,
  connections,
  following,
  defaultOpen = false,
  revealGatesOnClick = false,
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
  revealGatesOnClick?: boolean;
  className?: string;
}) {
  const gate = useCopyGateAccess();
  const copyDenial = gate ? followClickDenial(gate) : null;
  const access = useDeskTypeAccess();
  const quotaAccess = useQuotaAccess();
  const typeRow = deskTypeAccessFor(access, deskType);
  const typeDenied =
    access.length > 0 && typeRow && !typeRow.allowed ? typeRow.message : null;
  const quotasGated = quotaAccess.length > 0;
  const paperQuota = quotaAccessFor(quotaAccess, "max_paper_desks");
  const liveQuota = quotaAccessFor(
    quotaAccess,
    quotaKeyForDesk({ mode: "live", venueEnvironment }),
  );
  const paperOff = quotasGated && paperQuota ? !paperQuota.allowed : false;
  const liveOff = quotasGated && liveQuota ? !liveQuota.allowed : false;
  const planNotices = revealGatesOnClick
    ? copyDeskPlanNotices({
        typeRow,
        typeGated: access.length > 0,
        quotas: quotaAccess,
        quotasGated,
        venueEnvironment,
      })
    : [];
  const planBlocks = Boolean(typeDenied) || (paperOff && liveOff);
  const [open, setOpen] = useState(
    defaultOpen && !copyDenial && !(revealGatesOnClick && planBlocks),
  );
  const [copyNotice, setCopyNotice] = useState(defaultOpen ? copyDenial : null);
  const [shownPlanNotices, setShownPlanNotices] = useState<CopyDeskPlanNotice[]>(
    defaultOpen && revealGatesOnClick ? planNotices : [],
  );

  if (following) {
    return (
      <p className="whitespace-nowrap rounded-control border border-line px-4 py-2 text-center text-sm text-ink-muted">
        Following
      </p>
    );
  }

  let control: ReactNode;
  if (typeDenied && !revealGatesOnClick) {
    control = (
      <button
        type="button"
        disabled
        title={typeDenied}
        className={`inline-flex cursor-not-allowed items-center justify-center gap-2 opacity-40 ${className}`}
      >
        <BotButtonLead icon={<IconCopyTrading {...botBtnIcon} />}>
          Copy
        </BotButtonLead>
      </button>
    );
  } else {
    control = (
      <button
        type="button"
        onClick={() => {
          if (revealGatesOnClick) {
            setShownPlanNotices(planNotices);
          }
          if (copyDenial) {
            setCopyNotice(copyDenial);
            setOpen(false);
            return;
          }
          if (revealGatesOnClick && planBlocks) {
            setOpen(false);
            return;
          }
          setOpen(true);
        }}
        className={`inline-flex items-center justify-center gap-2 ${className}`}
      >
        <BotButtonLead icon={<IconCopyTrading {...botBtnIcon} />}>
          Copy
        </BotButtonLead>
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {shownPlanNotices.map((notice) => (
        <DeskTypeRejectBanner key={notice.key} access={notice} />
      ))}
      {copyNotice ? <DeskTypeRejectBanner access={copyNotice} /> : null}
      {control}
      {open && !typeDenied ? (
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
    </div>
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
  const quotaAccess = useQuotaAccess();
  const quotasGated = quotaAccess.length > 0;
  const paperQuota = quotaAccessFor(quotaAccess, "max_paper_desks");
  const liveQuota = quotaAccessFor(
    quotaAccess,
    quotaKeyForDesk({ mode: "live", venueEnvironment }),
  );
  const paperOff = quotasGated && paperQuota ? !paperQuota.allowed : false;
  const liveOff = quotasGated && liveQuota ? !liveQuota.allowed : false;
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
              <p className="text-hint text-ink-muted">{stamp}</p>
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
                <AppSelect
                  name="mode"
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value === "live" ? "live" : "paper")
                  }
                  className={fieldClass}
                >
                  <option value="paper" disabled={paperOff}>
                    {formatAccountModeChoice("paper")}
                  </option>
                  <option value="live" disabled={liveOff}>
                    {formatAccountModeChoice("live")}
                  </option>
                </AppSelect>
              </label>
              {mode === "live" ? (
                matching.length > 0 ? (
                  <label className="block text-sm text-ink">
                    Exchange connection
                    <AppSelect name="exchangeConnectionId" className={fieldClass}>
                      <option value="">Bind later in Desk Settings</option>
                      {matching.map((row) => (
                        <option key={row.id} value={row.id}>
                          {formatConnectionSummary(row)}
                        </option>
                      ))}
                    </AppSelect>
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
              disabled={mode === "paper" ? paperOff : liveOff}
              title={
                mode === "paper"
                  ? paperOff
                    ? paperQuota?.message ?? undefined
                    : undefined
                  : liveOff
                    ? liveQuota?.message ?? undefined
                    : undefined
              }
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              <BotButtonLead icon={<IconCopyTrading {...botBtnIcon} />}>
                Copy
              </BotButtonLead>
            </PendingSubmitButton>
            <label className="flex items-start gap-2 text-sm text-ink">
              <AppCheck name="goToDesk" />
              <span>Go to Copy Desk</span>
            </label>
          </div>
        </StayOnPageForm>
      )}
    </Modal>
  );
}
