import { firstSearchValue } from "@/lib/paper/open";
import { exchangePairsHref } from "@/lib/pairs/page";
import { redirect } from "next/navigation";

export default async function CashAndCarryPairsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const extra: Record<string, string> = {};
  for (const key of ["q", "base", "page", "sort", "dir", "minDte", "maxDte"]) {
    const value = firstSearchValue(params[key]);
    if (value) {
      extra[key] = value;
    }
  }
  redirect(exchangePairsHref("bybit", { kind: "carry", extra }));
}
