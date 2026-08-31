import Link from "next/link";
import { LogoFileField } from "@/components/logo-file-field";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  formatDeskType,
  formatDeskVenueCaption,
  type TradingAccount,
} from "@/lib/accounts/model";
import {
  inviteDeskCopyShareAction,
  revokeDeskCopyShareAction,
  saveDeskCopyListingAction,
} from "@/lib/copy/actions";
import {
  COPY_DESCRIPTION_MAX,
  COPY_FOLLOWING_UNAVAILABLE,
  COPY_SHARE_OFF_OPEN_TRADES,
  copyShareCountsTowardCap,
  type DeskCopyListing,
  type DeskCopyShare,
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
  openTradeCount = 0,
  shares = [],
}: {
  account: TradingAccount;
  listing: DeskCopyListing | null;
  block: string | null;
  needsAlias?: boolean;
  maxFollowersDefault?: number | null;
  maxFollowersCeiling?: number | null;
  openTradeCount?: number;
  shares?: DeskCopyShare[];
}) {
  const modeLabel = account.mode === "live" ? "Live" : "Paper";
  const stamp = `${formatDeskType(account.deskType)} · ${formatDeskVenueCaption(account)} · ${modeLabel}`;
  const sharingLockedOn =
    Boolean(listing?.sharingEnabled) && openTradeCount > 0;
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
          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-ink">
              {sharingLockedOn ? (
                <>
                  <input type="hidden" name="sharingEnabled" value="on" />
                  <input
                    type="checkbox"
                    defaultChecked
                    disabled
                    className="mt-0.5"
                  />
                </>
              ) : (
                <input
                  type="checkbox"
                  name="sharingEnabled"
                  defaultChecked={listing?.sharingEnabled ?? false}
                  className="mt-0.5"
                />
              )}
              <span>
                Enable sharing
                <span className="mt-1 block text-xs text-ink-muted">
                  Off keeps these notes saved but hides the desk from invites
                  and the catalogue. Followers then see that this desk is no
                  longer available for following.
                </span>
              </span>
            </label>
            {sharingLockedOn ? (
              <p
                role="note"
                className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
              >
                {COPY_SHARE_OFF_OPEN_TRADES}
              </p>
            ) : null}
          </div>
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
            <LogoFileField
              name="deskLogo"
              currentUrl={listing?.logoUrl ?? null}
              removeName={listing?.logoPath ? "removeDeskLogo" : undefined}
              removeLabel="Remove desk logo"
              hint="Optional. This desk's icon, separate from your trader logo. Square PNG, JPG, or WebP. 1 MB max."
              emptyTone="raised"
            />
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
              Private stays off the catalogue. Invite members by email below.
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
      {listing ? (
        <CopyInvitePanel
          listing={listing}
          shares={shares}
          canInvite={!block}
        />
      ) : null}
    </section>
  );
}

function CopyInvitePanel({
  listing,
  shares,
  canInvite,
}: {
  listing: DeskCopyListing;
  shares: DeskCopyShare[];
  canInvite: boolean;
}) {
  const openCount = shares.filter((row) =>
    copyShareCountsTowardCap(row.status),
  ).length;
  const capLabel =
    listing.maxFollowers == null
      ? `${openCount} invited`
      : `${openCount} of ${listing.maxFollowers} invited`;
  const inviteReady =
    canInvite && listing.sharingEnabled && listing.allowNewFollowers;
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div>
        <p className="text-sm text-ink">Private invites</p>
        <p className="mt-1 text-xs text-ink-muted">
          Email must already have a login. No email is sent. {capLabel}.
        </p>
      </div>
      {!listing.sharingEnabled ? (
        <p
          role="note"
          className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          {COPY_FOLLOWING_UNAVAILABLE} New invites are paused.
        </p>
      ) : null}
      {inviteReady ? (
        <form action={inviteDeskCopyShareAction} className="space-y-3">
          <label className="block text-sm text-ink">
            Invite email
            <input
              type="email"
              name="email"
              required
              autoComplete="off"
              placeholder="member@email"
              className={fieldClass}
            />
          </label>
          <PendingSubmitButton
            pendingLabel="Inviting…"
            successKey="invite-desk-copy"
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            Send invite
          </PendingSubmitButton>
        </form>
      ) : listing.sharingEnabled && !listing.allowNewFollowers ? (
        <p className="text-xs text-ink-muted">
          New followers are off. Existing invites stay until you revoke them.
        </p>
      ) : null}
      {shares.length === 0 ? (
        <p className="text-xs text-ink-faint">No invites yet.</p>
      ) : (
        <ul className="space-y-2">
          {shares.map((share) => (
            <li
              key={share.id}
              className="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink">
                  {share.invitedEmail}
                </span>
                <span className="text-xs text-ink-faint">
                  {share.status === "invited"
                    ? "Invited"
                    : share.status === "active"
                      ? "Following"
                      : "Revoked"}
                </span>
              </span>
              {share.status === "revoked" ? null : (
                <form action={revokeDeskCopyShareAction}>
                  <input type="hidden" name="shareId" value={share.id} />
                  <PendingSubmitButton
                    pendingLabel="Revoking…"
                    successKey={`revoke-desk-copy-${share.id}`}
                    className="rounded-control border border-line px-3 py-1.5 text-xs text-danger hover:bg-danger/10"
                  >
                    Revoke
                  </PendingSubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
