import type { Metadata } from "next";
import Link from "next/link";
import {
  ClosedFuturesTrades,
  FuturesPerformanceStats,
} from "@/components/futures-blotter";
import { CopyFollowButton } from "@/components/copy-follow-modal";
import { loadCopyCatalogueDesk } from "@/lib/copy/catalogue";
import { loadCopyDeskPublicClosed } from "@/lib/copy/desk-performance";
import { formatDeskType } from "@/lib/accounts/model";
import { getSessionMember } from "@/lib/auth/session";
import { listExchangeConnections } from "@/lib/exchanges/store";
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
  const [closed, connections] = await Promise.all([
    loadCopyDeskPublicClosed(card.accountId),
    listExchangeConnections(member.id),
  ]);
  const traderHref = card.traderAlias
    ? `/account/copy/traders/${encodeURIComponent(card.traderAlias)}`
    : "/account/copy";
  const stats = card.stats30d;
  const roi =
    !stats || stats.closedCount === 0
      ? "—"
      : stats.realizedPct == null
        ? formatSignedUsd(stats.realizedUsdt)
        : formatPct(stats.realizedPct);
  const drawdown =
    !stats || stats.closedCount === 0
      ? "—"
      : stats.maxDrawdownPct == null
        ? formatSignedUsd(stats.maxDrawdownUsdt)
        : formatPct(stats.maxDrawdownPct);
  const winRate =
    !stats || stats.closedCount === 0
      ? "—"
      : `${Math.round((stats.winCount / stats.closedCount) * 100)}%`;
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
      <section className="mb-8 rounded-card border border-line bg-surface p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-raised text-lg text-ink-muted">
            {card.traderLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.traderLogoUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              (card.traderAlias ?? "T").slice(0, 1).toUpperCase()
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {card.deskLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.deskLogoUrl}
                  alt=""
                  className="size-8 shrink-0 rounded-control border border-line object-cover"
                />
              ) : null}
              <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-ink">
                {card.deskName}
              </h1>
              <CopyFollowButton
                parentAccountId={card.accountId}
                deskName={card.deskName}
                deskType={card.deskType}
                venue={card.venue}
                venueEnvironment={card.venueEnvironment}
                connections={connections}
                following={card.following}
                className="rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
              />
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              <Link href={traderHref} className="text-ink hover:text-accent">
                {card.traderAlias ?? "Trader"}
              </Link>
              <span className="text-ink-faint">
                {" · "}
                {card.visibility === "private" ? "Private" : "Public"}
                {" · "}
                {formatDeskType(card.deskType)} · {card.venue}
              </span>
            </p>
            {card.description ? (
              <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm text-ink-muted">
                {card.description}
              </p>
            ) : null}
          </div>
        </div>
      </section>
      <div className="space-y-6">
        <FuturesPerformanceStats
          signedIn
          closed={closed}
          extras={[
            {
              label: "ROI [30d]",
              value: roi,
              toneClass:
                !stats || stats.closedCount === 0
                  ? undefined
                  : stats.realizedUsdt < 0
                    ? "text-danger"
                    : "text-success",
            },
            { label: "Drawdown [30d]", value: drawdown },
            { label: "Win rate [30d]", value: winRate },
            { label: "Followers", value: followers },
            { label: "Invited", value: String(card.invitedCount) },
          ]}
        />
        <ClosedFuturesTrades signedIn closed={closed} webhookNames={[]} />
      </div>
    </>
  );
}
