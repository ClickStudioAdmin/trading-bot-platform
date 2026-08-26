import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { FuturesWebhooksDesk } from "@/components/futures-webhooks-desk";
import { getSessionContext } from "@/lib/auth/session";
import { futuresWebhookOrigin } from "@/lib/futures/webhook";
import { listFuturesWebhooks } from "@/lib/futures/webhook-load";
import { firstSearchValue } from "@/lib/paper/open";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Futures webhooks",
  description: "TradingView doors for this Futures book.",
};

export default async function FuturesWebhooksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  const webhooks = session
    ? await listFuturesWebhooks({
        accountId: session.account.id,
        origin: futuresWebhookOrigin(await headers()),
      })
    : [];
  const error = firstSearchValue(params.error);
  const created = firstSearchValue(params.created) === "1";
  const rotated = firstSearchValue(params.rotated) === "1";
  const deleted = firstSearchValue(params.deleted) === "1";

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Webhooks" />
      <p className="-mt-4 text-sm text-ink-muted">
        Each URL is a door into this book. An <span className="text-ink">Order</span>{" "}
        webhook needs symbol and size in the JSON. A{" "}
        <span className="text-ink">Signal</span> webhook only arms or exits — a
        playbook (later) owns clips. Test from{" "}
        <Link href={FUTURES_PATHS.positions} className="text-accent">
          Positions
        </Link>
        .
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {created ? (
        <p className="mt-4 text-sm text-success">Webhook created.</p>
      ) : null}
      {rotated ? (
        <p className="mt-4 text-sm text-success">
          URL rotated. The previous URL no longer works.
        </p>
      ) : null}
      {deleted ? (
        <p className="mt-4 text-sm text-success">Webhook deleted.</p>
      ) : null}
      {session ? (
        <FuturesWebhooksDesk webhooks={webhooks} />
      ) : (
        <p className="mt-6 text-sm text-ink-muted">
          <Link href="/sign-in" className="text-accent">
            Sign in
          </Link>{" "}
          to create webhooks.
        </p>
      )}
    </main>
  );
}
