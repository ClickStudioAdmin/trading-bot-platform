import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export default async function AccountAffiliatesRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["error", "saved", "tab"]) {
    const value = firstSearchValue(params[key]);
    if (value) {
      query.set(key, value);
    }
  }
  const suffix = query.toString();
  redirect(suffix ? `/affiliates?${suffix}` : "/affiliates");
}
