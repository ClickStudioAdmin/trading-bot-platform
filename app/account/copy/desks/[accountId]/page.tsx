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
  const roi =
    !card.stats30d || card.stats30d.closedCount === 0
      ? "—"
      : card.stats30d.realizedPct == null
        ? formatSignedUsd(card.stats30d.realizedUsdt)
        : formatPct(card.stats30d.realizedPct);

  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/account/copy" className="text-accent">
          Copy desks
        </Link>
      </p>
      <section className="mb-8 rounded-card border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
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
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-ink-faint">
                Trader
              </p>
              <Link
                href={traderHref}
                className="block truncate text-sm font-medium text-ink hover:text-accent"
              >
                {card.traderAlias ?? "Trader"}
              </Link>
              <p className="mt-2 text-[11px] uppercase tracking-wide text-ink-faint">
                Desk
              </p>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                {card.deskLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.deskLogoUrl}
                    alt=""
                    className="size-8 shrink-0 rounded-control border border-line object-cover"
                  />
                ) : null}
                <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">
                  {card.deskName}
                </h1>
              </div>
              <p className="mt-2 text-sm text-ink-muted">
                {card.visibility === "private" ? "Private" : "Public"}
                {" · "}
                {formatDeskType(card.deskType)} · {card.venue}
              </p>
            </div>
          </div>
          <CopyFollowButton
            parentAccountId={card.accountId}
            deskName={card.deskName}
            deskType={card.deskType}
            venue={card.venue}
            venueEnvironment={card.venueEnvironment}
            connections={connections}
            following={card.following}
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          />
        </div>
        {card.description ? (
          <p className="mt-4 whitespace-pre-wrap text-sm text-ink-muted">
            {card.description}
          </p>
        ) : null}
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-faint">ROI [30d]</dt>
            <dd
              className={`mt-1 text-sm font-semibold tabular-nums ${
                !card.stats30d || card.stats30d.closedCount === 0
                  ? "text-ink"
                  : card.stats30d.realizedUsdt < 0
                    ? "text-danger"
                    : "text-success"
              }`}
            >
              {roi}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Following</dt>
            <dd className="mt-1 text-sm tabular-nums text-ink">
              {card.maxFollowers == null
                ? String(card.followerCount)
                : `${card.followerCount} / ${card.maxFollowers}`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Invited</dt>
            <dd className="mt-1 text-sm tabular-nums text-ink">
              {card.invitedCount}
            </dd>
          </div>
        </dl>
      </section>
      <div className="space-y-6">
        <FuturesPerformanceStats signedIn closed={closed} />
        <ClosedFuturesTrades signedIn closed={closed} webhookNames={[]} />
      </div>
    </>
  );
}
