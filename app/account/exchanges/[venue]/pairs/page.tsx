import { firstSearchValue } from "@/lib/paper/open";
import { exchangePairsHref } from "@/lib/pairs/page";
import { getVenue } from "@/lib/exchanges/venues";
import { notFound, redirect } from "next/navigation";

export default async function LegacyExchangePairsRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ venue: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const venue = getVenue((await params).venue);
  if (!venue?.enabled) {
    notFound();
  }
  const query = await searchParams;
  const extra: Record<string, string> = {};
  for (const key of ["q", "base", "page", "sort", "dir", "minDte", "maxDte"]) {
    const value = firstSearchValue(query[key]);
    if (value) {
      extra[key] = value;
    }
  }
  redirect(
    exchangePairsHref(venue.id, {
      environment: firstSearchValue(query.env),
      kind: firstSearchValue(query.kind) === "carry" ? "carry" : undefined,
      extra,
    }),
  );
}
