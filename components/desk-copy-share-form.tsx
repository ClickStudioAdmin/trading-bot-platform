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
}: {
  account: TradingAccount;
  listing: DeskCopyListing | null;
  block: string | null;
  needsAlias?: boolean;
  maxFollowersDefault?: number | null;
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
              Caps how many desks can copy this one. Empty means no cap.
            </span>
          </label>
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
