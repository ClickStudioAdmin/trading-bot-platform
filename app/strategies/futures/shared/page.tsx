import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import {
  DeskCopyFollowersList,
  DeskCopyPrivateShareCard,
} from "@/components/desk-copy-followers";
import { deskHref, deskIsCopy } from "@/lib/accounts/model";
import { loadDeskCopyListing } from "@/lib/copy/listings";
import { loadDeskCopyFollowerViews } from "@/lib/copy/shares";
import { firstSearchValue } from "@/lib/paper/open";
import { getSessionContext } from "@/lib/auth/session";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Manage Copy Traders",
  description: "Manage followers and private invites for this desk.",
};

export default async function FuturesSharedDesksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  if (deskIsCopy(session.account)) {
    redirect(deskHref(FUTURES_PATHS.settings, session.account.id));
  }
  const params = await searchParams;
  const savedFlag = firstSearchValue(params.saved);
  const error = firstSearchValue(params.error);
  const [listing, followers] = await Promise.all([
    loadDeskCopyListing(session.account.id),
    loadDeskCopyFollowerViews(session.account.id),
  ]);
  const settingsHref = deskHref(FUTURES_PATHS.settings, session.account.id);

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Manage Copy Traders" />
      <p className="-mt-4 text-sm text-ink-muted">
        Followers of this desk. Invite privately here. Visibility, logos, and
        caps stay on{" "}
        <Link href={settingsHref} className="text-accent">
          Desk Settings
        </Link>
        .
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {savedFlag === "invite" ? (
        <p className="mt-4 text-sm text-success">Invite sent.</p>
      ) : null}
      {savedFlag === "revoke" ? (
        <p className="mt-4 text-sm text-success">Invite revoked.</p>
      ) : null}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <DeskCopyFollowersList listing={listing} followers={followers} />
        <DeskCopyPrivateShareCard listing={listing} canInvite />
      </div>
    </main>
  );
}
