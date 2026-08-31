import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  inviteDeskCopyShareAction,
  revokeDeskCopyShareAction,
} from "@/lib/copy/actions";
import {
  COPY_FOLLOWING_UNAVAILABLE,
  copyOwnerFollowerLabel,
  copyOwnerFollowerSituation,
  copyShareCountsTowardCap,
  type DeskCopyFollowerView,
  type DeskCopyListing,
} from "@/lib/copy/model";
import { formatAuDateUtc, parseDisplayTime } from "@/lib/time/display";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

function formatShareDay(value: string): string | null {
  const ms = parseDisplayTime(value);
  return ms == null ? null : formatAuDateUtc(ms);
}

function statusTone(status: DeskCopyFollowerView["status"]): string {
  if (status === "active") {
    return "text-success";
  }
  if (status === "revoked") {
    return "text-ink-faint";
  }
  return "text-accent";
}

export function DeskCopyFollowersList({
  listing,
  followers,
}: {
  listing: DeskCopyListing | null;
  followers: DeskCopyFollowerView[];
}) {
  const openCount = followers.filter((row) =>
    copyShareCountsTowardCap(row.status),
  ).length;
  const capLabel =
    listing?.maxFollowers == null
      ? `${openCount} invited`
      : `${openCount} of ${listing.maxFollowers} invited`;
  return (
    <section className="space-y-4 rounded-card border border-line bg-surface p-5">
      <div>
        <h3 className="text-sm font-medium text-ink">Followers</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Private invites show email. Public followers show user id. {capLabel}.
        </p>
      </div>
      {followers.length === 0 ? (
        <p className="text-sm text-ink-faint">No followers yet.</p>
      ) : (
        <ul className="space-y-2">
          {followers.map((follower) => {
            const situation = copyOwnerFollowerSituation({
              status: follower.status,
              visibility: listing?.visibility,
              sharingEnabled: listing?.sharingEnabled ?? false,
              invitedOn: formatShareDay(follower.createdAt),
              updatedOn: formatShareDay(follower.updatedAt),
            });
            return (
              <li
                key={follower.id}
                className="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {copyOwnerFollowerLabel({
                      visibility: listing?.visibility,
                      invitedEmail: follower.invitedEmail,
                      toUserId: follower.toUserId,
                    })}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-xs font-medium ${statusTone(follower.status)}`}
                  >
                    {situation.statusLabel}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {situation.sourceLabel}
                  </span>
                  <span className="block text-xs text-ink-faint">
                    {situation.detail}
                  </span>
                </span>
                {follower.status === "revoked" ? (
                  <span className="w-[4.5rem] shrink-0" />
                ) : (
                  <form action={revokeDeskCopyShareAction} className="shrink-0">
                    <input type="hidden" name="shareId" value={follower.id} />
                    <PendingSubmitButton
                      pendingLabel="Revoking…"
                      successKey={`revoke-desk-copy-${follower.id}`}
                      className="rounded-control border border-line px-3 py-1.5 text-xs text-danger hover:bg-danger/10"
                    >
                      Revoke
                    </PendingSubmitButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function DeskCopyPrivateShareCard({
  listing,
  canInvite,
}: {
  listing: DeskCopyListing | null;
  canInvite: boolean;
}) {
  const inviteReady =
    canInvite &&
    Boolean(listing?.sharingEnabled) &&
    Boolean(listing?.allowNewFollowers);
  return (
    <section className="space-y-4 rounded-card border border-line bg-surface p-5">
      <div>
        <h3 className="text-sm font-medium text-ink">Private share</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Invite a member by email. They must already have a login. No email is
          sent.
        </p>
      </div>
      {!listing ? (
        <p className="text-sm text-ink-muted">
          Save share settings on Desk Settings before inviting.
        </p>
      ) : !listing.sharingEnabled ? (
        <p
          role="note"
          className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          {COPY_FOLLOWING_UNAVAILABLE} New invites are paused.
        </p>
      ) : inviteReady ? (
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
      ) : listing.allowNewFollowers ? (
        <p className="text-sm text-ink-muted">
          Sharing is blocked until Desk Settings is ready.
        </p>
      ) : (
        <p className="text-sm text-ink-muted">
          New followers are off. Existing invites stay until you revoke them.
        </p>
      )}
    </section>
  );
}
