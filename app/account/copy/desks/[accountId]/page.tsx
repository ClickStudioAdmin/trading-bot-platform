import type { Metadata } from "next";
import Link from "next/link";
import {
  ClosedFuturesTrades,
  FuturesPerformanceStats,
} from "@/components/futures-blotter";
import { CopyDeskDetailsHeader } from "@/components/copy-desk-details-header";
import { CopyFollowButton } from "@/components/copy-follow-modal";
import { loadCopyCatalogueDesk } from "@/lib/copy/catalogue";
import { loadCopyDeskPublicClosed } from "@/lib/copy/desk-performance";
import { getSessionMember } from "@/lib/auth/session";
import { listExchangeConnections } from "@/lib/exchanges/store";
import {
  deskWindowStats,
  formatTradingDaysNote,
  futuresClosedStats,
} from "@/lib/futures/stats";
import {
  formatPct,
  formatSignedUsd,
  signedTone,
} from "@/lib/opportunities/format";
import { notFound, redirect } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ accountId: string }>;
}): Promise<Metadata> {
  const member = await getSessionMember();
  if (!member) {
    return { title: "Copy desk" };
  }
  const { accountId: rawId } = await params;
  const card = await loadCopyCatalogueDesk({
    viewerUserId: member.id,
    accountId: decodeURIComponent(rawId),
  });
  return {
    title: card?.deskName ?? "Copy desk",
    description: "Performance for a shared copy desk.",
  };
}

export default async function CopyDeskPerformancePage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const { accountId: rawId } = await params;
  const accountId = decodeURIComponent(rawId);
  const card = await loadCopyCatalogueDesk({
    viewerUserId: member.id,
    accountId,
  });
  if (!card) {
    notFound();
  }
  const [closed, connections] = await Promise.all([
    loadCopyDeskPublicClosed(card.accountId),
    listExchangeConnections(member.id),
  ]);
  const allTime = deskWindowStats(closed);
  const stats = futuresClosedStats(closed);
  const empty = stats.closedCount === 0;
  const followers =
    card.maxFollowers == null
      ? String(card.followerCount)
      : `${card.followerCount} / ${card.maxFollowers}`;
  const roeHint =
    stats.roeTradeCount > 0 && stats.roeTradeCount < stats.closedCount
      ? `P&L vs initial margin (notional ÷ leverage). ROE on ${stats.roeTradeCount} of ${stats.closedCount} trades — the rest have no stored leverage.`
      : "P&L vs initial margin (notional ÷ leverage). Exchange-style ROE.";

  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/account/copy" className="text-accent">
          Copy Desks
        </Link>
      </p>
      <CopyDeskDetailsHeader
        card={card}
        action={
          <CopyFollowButton
            parentAccountId={card.accountId}
            deskName={card.deskName}
            deskType={card.deskType}
            venue={card.venue}
            venueEnvironment={card.venueEnvironment}
            connections={connections}
            following={card.following}
            className="whitespace-nowrap rounded-control bg-accent-strong px-4 py-2 text-center text-sm font-medium text-ink"
          />
        }
      >
        <FuturesPerformanceStats
          signedIn
          closed={closed}
          embedded
          items={[
            {
              label: "Completed Trades",
              value: String(stats.closedCount),
              note: formatTradingDaysNote(stats.tradingDays),
            },
            {
              label: "Win Rate",
              value: empty
                ? "—"
                : `${Math.round((stats.greenCount / stats.closedCount) * 100)}%`,
            },
            {
              label: "Realized P&L",
              value: empty ? "—" : formatSignedUsd(stats.realizedUsdt),
              toneClass: signedTone(empty ? null : stats.realizedUsdt),
              hint: "Closed-trade dollars. Leverage does not change this amount.",
            },
            {
              label: "P&L",
              value:
                empty || stats.onNotionalPct == null
                  ? "—"
                  : formatPct(stats.onNotionalPct),
              toneClass: signedTone(empty ? null : stats.realizedUsdt),
              hint: "Realized profit ÷ sum of closed position value (qty × entry).",
              note: "Based on position value",
            },
            {
              label: "ROE",
              value: empty || stats.roePct == null ? "—" : formatPct(stats.roePct),
              toneClass: signedTone(empty ? null : stats.roePct),
              hint: roeHint,
              note: "Based on margin requirement",
            },
            {
              label: "APR",
              value: empty || stats.aprPct == null ? "—" : formatPct(stats.aprPct),
              toneClass: signedTone(empty ? null : stats.aprPct),
              hint: "Compound annualization of ROE over the calendar span of this book (first close to last close). Short windows inflate APR.",
              note: "Annualized ROE",
            },
            { label: "Followers", value: followers },
            {
              label: "Max drawdown",
              value: empty
                ? "—"
                : allTime.maxDrawdownPct == null
                  ? formatSignedUsd(allTime.maxDrawdownUsdt)
                  : formatPct(allTime.maxDrawdownPct),
            },
          ]}
        />
      </CopyDeskDetailsHeader>
      <ClosedFuturesTrades signedIn closed={closed} webhookNames={[]} />
    </>
  );
}
