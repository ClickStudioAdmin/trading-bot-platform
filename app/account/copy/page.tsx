import type { Metadata } from "next";
import { CopyCatalogueBoard } from "@/components/copy-catalogue";
import { PageHeading } from "@/components/page-heading";
import { loadCopyCatalogue } from "@/lib/copy/catalogue";
import { copyCatalogueHref } from "@/lib/copy/catalogue-href";
import {
  parseCopyCatalogueSort,
  parseCopyCatalogueTab,
} from "@/lib/copy/model";
import { memberIsAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import { loadMemberNotificationChrome } from "@/lib/notifications/badges";
import { connectionIdsBoundToOtherDesks } from "@/lib/exchanges/connections";
import {
  listConnectionDeskBinds,
  listExchangeConnections,
} from "@/lib/exchanges/store";
import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Copy Trading",
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
  const [connections, sharedConnectionIds] = await Promise.all([
    listExchangeConnections(member.id),
    listConnectionDeskBinds(member.id).then((binds) =>
      connectionIdsBoundToOtherDesks(binds),
    ),
  ]);
  const allowSharedKeys = memberIsAdmin(member);
  const openParentId = firstSearchValue(params.copy) ?? "";
  const next = copyCatalogueHref({ tab, privateOnly, query, sort });
  const chrome = await loadMemberNotificationChrome(
    member.id,
    member.platformMember,
  );

  return (
    <>
      <PageHeading as="h1" title="Copy Trading" />
      {error ? (
        <p className="mb-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {unfollowed ? (
        <p className="mb-4 rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
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
        sharedConnectionIds={sharedConnectionIds}
        allowSharedKeys={allowSharedKeys}
        openParentId={openParentId}
        inviteCount={chrome.actions.copyInvite}
        revealCopyGatesOnClick
      />
    </>
  );
}
