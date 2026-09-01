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
          exchangeBook
        />
      </CopyDeskDetailsHeader>
      <ClosedFuturesTrades signedIn closed={closed} webhookNames={[]} />
    </>
  );
}
