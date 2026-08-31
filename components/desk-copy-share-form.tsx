import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  formatDeskType,
  formatDeskVenueCaption,
  type TradingAccount,
} from "@/lib/accounts/model";
import { saveDeskCopyListingAction } from "@/lib/copy/actions";
import {
  COPY_DESCRIPTION_MAX,
  type DeskCopyListing,
} from "@/lib/copy/model";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function DeskCopyShareCard({
  account,
  listing,
  block,
  needsAlias = false,
  maxFollowersDefault = null,
  maxFollowersCeiling = null,
}: {
  account: TradingAccount;
  listing: DeskCopyListing | null;
  block: string | null;
  needsAlias?: boolean;
  maxFollowersDefault?: number | null;
  maxFollowersCeiling?: number | null;
}) {
  const modeLabel = account.mode === "live" ? "Live" : "Paper";
  const stamp = `${formatDeskType(account.deskType)} · ${formatDeskVenueCaption(account)} · ${modeLabel}`;
  return (
    <section className="space-y-4 rounded-card border border-line bg-surface p-5">
      <div>
        <h3 className="text-sm font-medium text-ink">Share this desk</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Followers copy fills, not recipes. Venue, type, and Live are stamped.
          Email is never shown.
        </p>
        <p className="mt-2 text-xs text-ink-faint">{stamp}</p>
      </div>
      {block ? (
        <p className="text-sm text-ink-muted">
          {block}{" "}
          {needsAlias ? (
            <Link href="/account/settings" className="text-accent">
              Open Account Settings
            </Link>
          ) : null}
        </p>
      ) : (
        <form action={saveDeskCopyListingAction} className="space-y-4">
          <label className="block text-sm text-ink">
            Visibility
            <select
              name="visibility"
              defaultValue={listing?.visibility ?? "private"}
              className={fieldClass}
            >
              <option value="private">Private — invite only</option>
              <option value="public">Public — catalogue</option>
            </select>
            <span className="mt-1 block text-xs text-ink-faint">
              Private stays off the catalogue. Invites are next.
            </span>
          </label>
          <label className="block text-sm text-ink">
            Setup description
            <textarea
              name="description"
              required
              minLength={1}
              maxLength={COPY_DESCRIPTION_MAX}
              rows={4}
              defaultValue={listing?.description ?? ""}
              placeholder="Hedge vs one-way, size, anything a copier should know."
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-ink">
            Maximum copy traders
            <GroupedNumberInput
              name="maxFollowers"
              defaultValue={
                listing
                  ? listing.maxFollowers == null
                    ? ""
                    : String(listing.maxFollowers)
                  : maxFollowersDefault == null
                    ? ""
                    : String(maxFollowersDefault)
              }
              placeholder="No cap"
              ariaLabel="Maximum copy traders"
              className={fieldClass}
            />
            <span className="mt-1 block text-xs text-ink-faint">
              {maxFollowersCeiling == null
                ? "Caps how many desks can copy this one. Empty means no cap."
                : `Caps how many desks can copy this one. Platform maximum is ${maxFollowersCeiling}. Empty uses that maximum.`}
            </span>
          </label>
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-sm text-ink">Copier requirements</p>
            <p className="text-xs text-ink-muted">
              Checked when a Live copy desk is enabled or unpaused. Paper
              followers skip this. Mode and leverage stay in the setup notes
              until we can read them from the venue.
            </p>
            <label className="block text-sm text-ink">
              Minimum account balance
              <span className="relative mt-1 block">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
                  $
                </span>
                <GroupedNumberInput
                  name="minBalanceUsdt"
                  defaultValue={
                    listing?.minBalanceUsdt == null
                      ? ""
                      : String(listing.minBalanceUsdt)
                  }
                  allowDecimal
                  placeholder="No floor"
                  ariaLabel="Minimum account balance"
                  className="mt-0 w-full rounded-control border border-line bg-surface-raised py-2 pr-3 pl-7 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
                />
              </span>
              <span className="mt-1 block text-xs text-ink-faint">
                Live copiers need at least this much available. Empty means no
                floor.
              </span>
            </label>
          </div>
          <PendingSubmitButton
            pendingLabel="Saving…"
            successKey="save-desk-copy-share"
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            {listing ? "Save share" : "Share desk"}
          </PendingSubmitButton>
        </form>
      )}
    </section>
  );
}
