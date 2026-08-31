import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { pauseDeskCopyAction } from "@/lib/copy/actions";
import type { CopyLeaderStripData } from "@/lib/copy/leader";
import { COPY_FOLLOWING_UNAVAILABLE } from "@/lib/copy/model";
import { deskHref, formatDeskType } from "@/lib/accounts/model";
import { formatPct, formatSignedUsd } from "@/lib/opportunities/format";
import { FUTURES_PATHS } from "@/lib/strategies/registry";

function roiLabel(stats: CopyLeaderStripData["stats30d"]): string {
  if (!stats || stats.closedCount === 0) {
    return "—";
  }
  if (stats.realizedPct == null) {
    return formatSignedUsd(stats.realizedUsdt);
  }
  return formatPct(stats.realizedPct);
}

function drawdownLabel(stats: CopyLeaderStripData["stats30d"]): string {
  if (!stats || stats.closedCount === 0) {
    return "—";
  }
  if (stats.maxDrawdownPct == null) {
    return formatSignedUsd(stats.maxDrawdownUsdt);
  }
  return formatPct(stats.maxDrawdownPct);
}

function winRateLabel(stats: CopyLeaderStripData["stats30d"]): string {
  if (!stats || stats.closedCount === 0) {
    return "—";
  }
  return `${Math.round((stats.winCount / stats.closedCount) * 100)}%`;
}

export function CopyLeaderStrip({
  leader,
  paused,
  deskId,
  next,
}: {
  leader: CopyLeaderStripData | null;
  paused: boolean;
  deskId: string;
  next: string;
}) {
  const settingsHref = deskHref(FUTURES_PATHS.settings, deskId);
  const traderHref = leader?.traderAlias
    ? `/account/copy/traders/${encodeURIComponent(leader.traderAlias)}`
    : "/account/copy";
  const stats = leader?.stats30d ?? null;

  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-raised text-sm text-ink-muted">
            {leader?.traderLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={leader.traderLogoUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              (leader?.traderAlias ?? "T").slice(0, 1).toUpperCase()
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">
              Copying
            </p>
            {leader ? (
              <>
                <Link
                  href={traderHref}
                  className="block truncate text-sm font-medium text-ink hover:text-accent"
                >
                  {leader.traderAlias ?? "Trader"}
                </Link>
                <p className="mt-0.5 truncate text-sm text-ink-muted">
                  {leader.deskName}
                  <span className="text-ink-faint">
                    {" "}
                    · {formatDeskType(leader.deskType)} · {leader.venueLabel}
                  </span>
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                The parent desk is no longer available.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={pauseDeskCopyAction}>
            <input type="hidden" name="next" value={next} />
            <input
              type="hidden"
              name="paused"
              value={paused ? "0" : "1"}
            />
            <PendingSubmitButton
              pendingLabel={paused ? "Resuming…" : "Pausing…"}
              successKey="copy-pause"
              className="rounded-control border border-line px-3 py-1.5 text-sm text-ink hover:bg-surface-raised"
            >
              {paused ? "Resume copying" : "Pause copying"}
            </PendingSubmitButton>
          </form>
          <Link
            href={settingsHref}
            className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
          >
            Guards
          </Link>
        </div>
      </div>
      {paused ? (
        <p className="mt-4 rounded-control border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          Copying is paused. Close All still works. New parent fills will not
          copy until you resume.
        </p>
      ) : null}
      {leader && !leader.followingAvailable ? (
        <p className="mt-4 text-sm text-ink-muted">
          {COPY_FOLLOWING_UNAVAILABLE} Existing positions stay on this desk.
        </p>
      ) : null}
      {leader ? (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <dt className="text-xs text-ink-faint">ROI [30d]</dt>
              <dd
                className={`mt-1 text-sm font-semibold tabular-nums ${
                  !stats || stats.closedCount === 0
                    ? "text-ink"
                    : stats.realizedUsdt < 0
                      ? "text-danger"
                      : "text-success"
                }`}
              >
                {roiLabel(stats)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Drawdown [30d]</dt>
              <dd className="mt-1 text-sm tabular-nums text-ink">
                {drawdownLabel(stats)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Win rate [30d]</dt>
              <dd className="mt-1 text-sm tabular-nums text-ink">
                {winRateLabel(stats)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Following this desk</dt>
              <dd className="mt-1 text-sm tabular-nums text-ink">
                {leader.followerCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Trader followers</dt>
              <dd className="mt-1 text-sm tabular-nums text-ink">
                {leader.uniqueFollowers}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Shared desks</dt>
              <dd className="mt-1 text-sm tabular-nums text-ink">
                {leader.visibleDeskCount}
                {leader.firstSharedLabel
                  ? ` · since ${leader.firstSharedLabel}`
                  : ""}
              </dd>
            </div>
          </dl>
          {leader.brief ? (
            <p className="mt-4 whitespace-pre-wrap text-sm text-ink-muted">
              {leader.brief}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
