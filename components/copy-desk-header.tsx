import Link from "next/link";
import { CopyDeskHeaderActions } from "@/components/copy-desk-header-actions";
import { formatDeskType, type TradingAccount } from "@/lib/accounts/model";
import { listTradingAccounts, loadAccountUsage } from "@/lib/accounts/store";
import { loadDeskCopySettings } from "@/lib/copy/follower-settings";
import { loadCopyLeaderStrip } from "@/lib/copy/leader";
import {
  COPY_FOLLOWING_UNAVAILABLE,
  copyLiveTradeCount,
  copyUnfollowBlockCode,
} from "@/lib/copy/model";

export async function CopyDeskHeader({
  account,
  next,
}: {
  account: TradingAccount;
  next: string;
}) {
  if (!account.copyOfAccountId) {
    return null;
  }
  const [leader, settings, desks, usageMap] = await Promise.all([
    loadCopyLeaderStrip(account.copyOfAccountId),
    loadDeskCopySettings(account.id),
    listTradingAccounts(account.userId),
    loadAccountUsage([account]),
  ]);
  const usage = usageMap.get(account.id);
  const unfollowBlock = copyUnfollowBlockCode({
    liveTradeCount: copyLiveTradeCount({
      openPositions: usage?.futuresOpenCount,
      workingOrders: usage?.workingCount,
    }),
    deskCount: desks.length,
  });
  const traderHref = leader?.traderAlias
    ? `/account/copy/traders/${encodeURIComponent(leader.traderAlias)}`
    : "/account/copy";

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-6 sm:gap-16">
          <div className="flex min-w-0 items-start gap-3 sm:min-w-[16rem]">
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-control border border-line bg-surface-raised text-sm text-ink-muted">
              {leader?.deskLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={leader.deskLogoUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                (leader?.deskName ?? "D").slice(0, 1).toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              {leader ? (
                <>
                  <p className="text-[11px] uppercase tracking-wide text-ink-faint">
                    Desk
                  </p>
                  <h1 className="truncate text-xl font-semibold tracking-tight text-ink">
                    {leader.deskName}
                  </h1>
                  <p className="truncate text-sm text-ink-muted">
                    {formatDeskType(leader.deskType)} · {leader.venueLabel}
                  </p>
                </>
              ) : (
                <h1 className="text-xl font-semibold tracking-tight text-ink">
                  Parent desk unavailable
                </h1>
              )}
            </div>
          </div>
          {leader ? (
            <Link
              href={traderHref}
              className="flex min-w-0 items-start gap-3 hover:text-accent"
            >
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-raised text-sm text-ink-muted">
                {leader.traderLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={leader.traderLogoUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  (leader.traderAlias ?? "T").slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] uppercase tracking-wide text-ink-faint">
                  Trader
                </span>
                <span className="block truncate text-xl font-semibold tracking-tight text-ink">
                  {leader.traderAlias ?? "Trader"}
                </span>
                <span className="mt-1 block text-sm text-ink-muted">
                  View trader
                </span>
              </span>
            </Link>
          ) : null}
        </div>
        <CopyDeskHeaderActions
          paused={settings.paused}
          next={next}
          unfollowBlock={unfollowBlock}
        />
      </div>
      {settings.paused ? (
        <p className="mt-3 text-sm text-warning">
          Copying is paused. Close All still works.
        </p>
      ) : null}
      {leader && !leader.followingAvailable ? (
        <p className="mt-3 text-sm text-ink-muted">
          {COPY_FOLLOWING_UNAVAILABLE}
        </p>
      ) : null}
    </div>
  );
}
