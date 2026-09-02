import type { Metadata } from "next";
import Link from "next/link";
import { CopyCatalogueBoard } from "@/components/copy-catalogue";
import { PageHeading } from "@/components/page-heading";
import { loadTraderCatalogueDesks } from "@/lib/copy/catalogue";
import { loadTraderProfileByAlias } from "@/lib/copy/profile";
import { formatAuDateUtc, parseDisplayTime } from "@/lib/time/display";
import { getSessionMember } from "@/lib/auth/session";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Trader",
  description: "Shared desks for this trader.",
};

export default async function CopyTraderPage({
  params,
}: {
  params: Promise<{ alias: string }>;
}) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const { alias: rawAlias } = await params;
  const trader = await loadTraderProfileByAlias(decodeURIComponent(rawAlias));
  if (!trader) {
    notFound();
  }
  const desks = await loadTraderCatalogueDesks({
    viewerUserId: member.id,
    traderUserId: trader.userId,
  });
  const firstSharedMs = desks
    .map((row) => parseDisplayTime(row.createdAt))
    .filter((ms): ms is number => ms != null)
    .sort((a, b) => a - b)[0];
  const followers = desks.reduce((sum, row) => sum + row.followerCount, 0);
  const connections = await listExchangeConnections(member.id);
  const next = `/account/copy/traders/${encodeURIComponent(trader.alias)}`;

  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/account/copy" className="text-accent">
          Copy Trading
        </Link>
      </p>
      <div className="mb-6 flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-raised text-lg text-ink-muted">
          {trader.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={trader.logoUrl} alt="" className="size-full object-cover" />
          ) : (
            trader.alias.slice(0, 1).toUpperCase()
          )}
        </span>
        <div>
          <PageHeading as="h1" title={trader.alias} />
          {trader.bio ? (
            <p className="-mt-4 text-sm text-ink-muted">{trader.bio}</p>
          ) : (
            <p className="-mt-4 text-sm text-ink-faint">No bio yet.</p>
          )}
        </div>
      </div>
      <dl className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-surface p-5">
          <dt className="text-xs text-ink-faint">Followers</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">
            {followers}
          </dd>
        </div>
        <div className="rounded-card border border-line bg-surface p-5">
          <dt className="text-xs text-ink-faint">Visible desks</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">
            {desks.length}
          </dd>
        </div>
        <div className="rounded-card border border-line bg-surface p-5">
          <dt className="text-xs text-ink-faint">First shared</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">
            {firstSharedMs ? formatAuDateUtc(firstSharedMs) : "—"}
          </dd>
        </div>
      </dl>
      <CopyCatalogueBoard
        cards={desks}
        tab="all"
        privateOnly={false}
        query=""
        sort="newest"
        next={next}
        connections={connections}
        showFilters={false}
      />
    </>
  );
}
