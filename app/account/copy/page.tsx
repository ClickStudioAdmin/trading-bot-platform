import type { Metadata } from "next";
import { CopyCatalogueBoard } from "@/components/copy-catalogue";
import { PageHeading } from "@/components/page-heading";
import { loadCopyCatalogue } from "@/lib/copy/catalogue";
import { copyCatalogueHref } from "@/lib/copy/catalogue-href";
import {
  parseCopyCatalogueSort,
  parseCopyCatalogueTab,
} from "@/lib/copy/model";
import { getSessionMember } from "@/lib/auth/session";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Copy desks",
  description: "Public shared desks and your private invites.",
};

export default async function AccountCopyCataloguePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const params = await searchParams;
  const tab = parseCopyCatalogueTab(firstSearchValue(params.tab));
  const sort = parseCopyCatalogueSort(firstSearchValue(params.sort));
  const query = firstSearchValue(params.q) ?? "";
  const privateOnly = firstSearchValue(params.private) === "1";
  const error = firstSearchValue(params.error);
  const unfollowed = firstSearchValue(params.unfollowed) === "1";
  const cards = await loadCopyCatalogue({
    viewerUserId: member.id,
    tab,
    privateOnly,
    query,
    sort,
  });
  const connections = await listExchangeConnections(member.id);
  const openParentId = firstSearchValue(params.copy) ?? "";
  const next = copyCatalogueHref({ tab, privateOnly, query, sort });

  return (
    <>
      <PageHeading as="h1" title="Copy desks" />
      <p className="-mt-4 mb-6 text-sm text-ink-muted">
        Public listings plus private invites sent to you. Star a desk to keep
        it on Favorites. Subscribed is desks you are currently following.
      </p>
      {error ? (
        <p className="mb-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {unfollowed ? (
        <p className="mb-4 text-sm text-success">
          You unfollowed that desk. The copy desk was deleted. A
          private invite still lets you follow again.
        </p>
      ) : null}
      <CopyCatalogueBoard
        cards={cards}
        tab={tab}
        privateOnly={privateOnly}
        query={query}
        sort={sort}
        next={next}
        connections={connections}
        openParentId={openParentId}
      />
    </>
  );
}
