import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DeskBlotterFilters } from "@/components/desk-blotter-filters";
import {
  ClosedFuturesTrades,
  FuturesPerformanceStats,
} from "@/components/futures-blotter";
import { CopyDeskDetailsHeader } from "@/components/copy-desk-details-header";
import { CopyFollowButton } from "@/components/copy-follow-modal";
import {
  CopyDeskPageNotices,
  CopyFollowTrialLine,
} from "@/components/copy-gate-access";
import { loadCopyCatalogueDesk } from "@/lib/copy/catalogue";
import { copyDeskPagePath } from "@/lib/copy/model";
import { loadCopyDeskPublicClosed } from "@/lib/copy/desk-performance";
import { memberIsAdmin } from "@/lib/admin/access";
import { sharedDeskVisible } from "@/lib/exchanges/availability";
import { loadExchangeAccessForUser } from "@/lib/exchanges/availability-store";
import { getSessionMember } from "@/lib/auth/session";
import { connectionIdsBoundToOtherDesks } from "@/lib/exchanges/connections";
import {
  listConnectionDeskBinds,
  listExchangeConnections,
} from "@/lib/exchanges/store";
import {
  deskBlotterFiltersActive,
  filterFuturesBlotterRows,
  parseDeskBlotterFilters,
} from "@/lib/desk-blotter-filters";
import { tableFiltersSuggestOpen } from "@/lib/table-chrome";
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
  const visible =
    card &&
    sharedDeskVisible(await loadExchangeAccessForUser(member.id), card);
  return {
    title: visible ? card.deskName : "Copy desk",
    description: "Performance for a shared copy desk.",
  };
}

export default async function CopyDeskPerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  const exchangeAccess = await loadExchangeAccessForUser(member.id);
  if (!sharedDeskVisible(exchangeAccess, card)) {
    notFound();
  }
  const [closed, connections, sharedConnectionIds] = await Promise.all([
    loadCopyDeskPublicClosed(card.accountId),
    listExchangeConnections(member.id),
    listConnectionDeskBinds(member.id).then((binds) =>
      connectionIdsBoundToOtherDesks(binds),
    ),
  ]);
  const query = await searchParams;
  const filters = parseDeskBlotterFilters(query);
  const visibleClosed = filterFuturesBlotterRows(
    closed,
    filters,
    [],
    undefined,
    { inferBot: false },
  );

  const traderHref = card.traderAlias
    ? `/account/copy/traders/${encodeURIComponent(card.traderAlias)}`
    : null;

  return (
    <>
      <Breadcrumbs
        items={[
          { href: "/account/copy", label: "Copy Trading" },
          ...(traderHref && card.traderAlias
            ? [{ href: traderHref, label: card.traderAlias }]
            : []),
          { label: card.deskName },
        ]}
      />
      <CopyDeskPageNotices deskType={card.deskType} />
      <div>
        <CopyDeskDetailsHeader
          card={card}
          action={
            <div className="flex w-full flex-col gap-2">
              <CopyFollowTrialLine />
              <CopyFollowButton
                parentAccountId={card.accountId}
                deskName={card.deskName}
                deskType={card.deskType}
                venue={card.venue}
                venueEnvironment={card.venueEnvironment}
                connections={connections}
                sharedConnectionIds={sharedConnectionIds}
                allowSharedKeys={memberIsAdmin(member)}
                following={card.following}
                className="whitespace-nowrap rounded-control bg-accent-strong px-4 py-2 text-center text-sm font-medium text-ink"
              />
            </div>
          }
        >
          <FuturesPerformanceStats
            signedIn
            closed={closed}
            embedded
            exchangeBook
          />
        </CopyDeskDetailsHeader>
        <ClosedFuturesTrades
          signedIn
          closed={visibleClosed}
          webhookNames={[]}
          filtersOpen={tableFiltersSuggestOpen(query)}
          filterBar={
            <DeskBlotterFilters
              values={filters}
              bots={[]}
              clearHref={copyDeskPagePath(accountId)}
            />
          }
          emptyMessage={
            deskBlotterFiltersActive(filters)
              ? "No positions match these filters."
              : undefined
          }
        />
      </div>
    </>
  );
}
