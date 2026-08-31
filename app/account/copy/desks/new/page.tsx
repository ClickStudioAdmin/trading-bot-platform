import type { Metadata } from "next";
import Link from "next/link";
import { CreateCopyDeskForm } from "@/components/create-copy-desk-form";
import { PageHeading } from "@/components/page-heading";
import {
  formatDeskType,
  formatDeskVenueCaption,
} from "@/lib/accounts/model";
import { loadTradingAccountById } from "@/lib/accounts/store";
import { loadDeskCopyListing } from "@/lib/copy/listings";
import { getSessionMember } from "@/lib/auth/session";
import {
  connectionFitsDesk,
  getVenue,
} from "@/lib/exchanges/venues";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Create copy desk",
  description: "Copy another member’s fills onto your own desk.",
};

export default async function CreateCopyDeskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const params = await searchParams;
  const parentId = firstSearchValue(params.parent) ?? "";
  if (!parentId) {
    redirect("/account/copy");
  }
  const parent = await loadTradingAccountById(parentId);
  if (!parent) {
    redirect("/account/copy");
  }
  const listing = await loadDeskCopyListing(parent.id);
  const error = firstSearchValue(params.error);
  const connections = (await listExchangeConnections(member.id)).filter(
    (row) => {
      if (row.status !== "active") {
        return false;
      }
      return connectionFitsDesk({
        deskVenue: parent.venue,
        deskEnvironment: parent.venueEnvironment,
        connectionVenue: row.venue,
        connectionEnvironment: row.environment,
      }).ok;
    },
  );
  const deskName = listing?.name || parent.name;
  const venue = getVenue(parent.venue);
  const stamp = `${formatDeskType(parent.deskType)} · ${formatDeskVenueCaption(parent)} · ${venue?.label ?? parent.venue}`;

  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/account/copy" className="text-accent">
          Copy desks
        </Link>
      </p>
      <PageHeading as="h1" title="Create copy desk" />
      <p className="-mt-4 mb-6 text-sm text-ink-muted">
        Type and venue are stamped from {deskName}. You pick Paper or Live.
        Size follows account balances. Recipes and keys stay on the parent.
      </p>
      {error ? (
        <p className="mb-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="max-w-lg">
        <CreateCopyDeskForm
          parentAccountId={parent.id}
          defaultName={`Copy of ${deskName}`.slice(0, 40)}
          stamp={stamp}
          connections={connections}
        />
      </div>
    </>
  );
}
