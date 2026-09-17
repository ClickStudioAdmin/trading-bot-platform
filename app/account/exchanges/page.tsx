import { withQuery } from "@/lib/accounts/model";
import { firstSearchValue } from "@/lib/paper/open";
import { ACCOUNT_EXCHANGES_HREF } from "@/lib/site-links";
import { redirect } from "next/navigation";

export default async function AccountExchangesRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const extra: Record<string, string> = {};
  for (const key of ["error", "saved", "renamed", "replaced", "removed"]) {
    const value = firstSearchValue(params[key]);
    if (value) {
      extra[key] = value;
    }
  }
  redirect(withQuery(ACCOUNT_EXCHANGES_HREF, extra));
}
