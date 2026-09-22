import { getSessionContext } from "@/lib/auth/session";
import { firstSearchValue } from "@/lib/paper/open";
import { exchangePairsHref } from "@/lib/pairs/page";
import { redirect } from "next/navigation";

export default async function FuturesPairsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
  const params = await searchParams;
  const extra: Record<string, string> = {};
  for (const key of ["q", "base", "page", "sort", "dir"]) {
    const value = firstSearchValue(params[key]);
    if (value) {
      extra[key] = value;
    }
  }
  const venue = session?.account.venue === "hyperliquid" ? "hyperliquid" : "bybit";
  redirect(
    exchangePairsHref(venue, {
      environment: session?.account.venueEnvironment,
      extra,
    }),
  );
}
