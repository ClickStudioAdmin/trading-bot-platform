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
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-raised text-sm text-ink-muted">
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
        <div className="min-w-0 flex-1">
          {leader ? (
            <>
              <h1 className="truncate text-xl font-semibold tracking-tight text-ink">
                <Link href={traderHref} className="hover:text-accent">
                  {leader.traderAlias ?? "Trader"}
                </Link>
              </h1>
              <p className="truncate text-sm text-ink-muted">
                {leader.deskName}
                <span className="text-ink-faint">
                  {" "}
                  · {formatDeskType(leader.deskType)} · {leader.venueLabel}
                </span>
              </p>
            </>
          ) : (
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              Parent desk unavailable
            </h1>
          )}
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
