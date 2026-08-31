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
        <p
          role="note"
          className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          {block}{" "}
          {needsAlias ? (
            <Link href="/account/settings" className="font-medium text-ink underline underline-offset-2">
              Open Account Settings
            </Link>
          ) : null}
        </p>
      ) : (
        <form action={saveDeskCopyListingAction} className="space-y-4">
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="sharingEnabled"
              defaultChecked={listing?.sharingEnabled ?? false}
              className="mt-0.5"
            />
            <span>
              Enable sharing
              <span className="mt-1 block text-xs text-ink-muted">
                Off keeps these notes saved but hides the desk from invites
                and the catalogue.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="allowNewFollowers"
              defaultChecked={listing?.allowNewFollowers ?? true}
              className="mt-0.5"
            />
            <span>
              Allow new followers
              <span className="mt-1 block text-xs text-ink-muted">
                Off blocks new copy desks. Current followers keep copying.
                Only applies while sharing is on.
              </span>
            </span>
          </label>
          <div>
            <p className="text-sm text-ink">Desk logo</p>
            <div className="mt-1 flex items-center gap-3">
              {listing?.logoUrl ? (
                // Public desk mark stored in Supabase Storage.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listing.logoUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded-card border border-line object-cover"
                />
              ) : (
                <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-card border border-line bg-surface-raised text-[11px] text-ink-faint">
                  None
                </span>
              )}
              <div className="min-w-0 flex-1">
                <input
                  type="file"
                  name="deskLogo"
                  accept="image/png,image/jpeg,image/webp"
                  className="w-full text-sm text-ink file:mr-3 file:rounded-control file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-line"
                />
                <p className="mt-1 text-xs text-ink-faint">
                  Optional. This desk&apos;s icon, separate from your trader
                  logo. Square PNG, JPG, or WebP. 1 MB max.
                </p>
              </div>
            </div>
            {listing?.logoPath ? (
              <label className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  name="removeDeskLogo"
                  className="mt-0.5"
                />
                Remove desk logo
              </label>
            ) : null}
          </div>
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
            Save share
          </PendingSubmitButton>
        </form>
      )}
    </section>
  );
}
