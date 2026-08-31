import type { Metadata } from "next";
import Link from "next/link";
import {
  ClosedFuturesTrades,
  FuturesPerformanceStats,
} from "@/components/futures-blotter";
import { CopyDeskDetailsHeader } from "@/components/copy-desk-details-header";
import { loadCopyCatalogueDesk } from "@/lib/copy/catalogue";
import { loadCopyDeskPublicClosed } from "@/lib/copy/desk-performance";
import { getSessionMember } from "@/lib/auth/session";
import { deskWindowStats } from "@/lib/futures/stats";
import { formatPct, formatSignedUsd } from "@/lib/opportunities/format";
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
  const closed = await loadCopyDeskPublicClosed(card.accountId);
  const allTime = deskWindowStats(closed);
  const empty = allTime.closedCount === 0;
  const followers =
    card.maxFollowers == null
      ? String(card.followerCount)
      : `${card.followerCount} / ${card.maxFollowers}`;

  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/account/copy" className="text-accent">
          Copy desks
        </Link>
      </p>
      <CopyDeskDetailsHeader card={card}>
        <FuturesPerformanceStats
          signedIn
          closed={closed}
          embedded
          items={[
            {
              label: "Completed trades",
              value: String(allTime.closedCount),
            },
            {
              label: "Win rate",
              value: empty
                ? "—"
                : `${Math.round((allTime.winCount / allTime.closedCount) * 100)}%`,
            },
            {
              label: "Realized P&L",
              value: empty ? "—" : formatSignedUsd(allTime.realizedUsdt),
              toneClass: empty
                ? undefined
                : allTime.realizedUsdt < 0
                  ? "text-danger"
                  : "text-success",
            },
            {
              label: "ROI",
              value: empty || allTime.realizedPct == null
                ? "—"
                : formatPct(allTime.realizedPct),
              toneClass:
                empty || allTime.realizedUsdt === 0
                  ? undefined
                  : allTime.realizedUsdt < 0
                    ? "text-danger"
                    : "text-success",
            },
            { label: "Followers", value: followers },
            { label: "Invited", value: String(card.invitedCount) },
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
