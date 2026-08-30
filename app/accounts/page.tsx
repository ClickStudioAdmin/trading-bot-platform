import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export default async function AccountsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["error", "created", "deleted", "renamed"] as const) {
    const value = firstSearchValue(params[key]);
    if (value) {
      query.set(key, value);
    }
  }
  const suffix = query.toString();
  redirect(`/account/sub-accounts${suffix ? `?${suffix}` : ""}`);
}
