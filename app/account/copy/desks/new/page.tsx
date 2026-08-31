import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export default async function CreateCopyDeskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parentId = firstSearchValue(params.parent) ?? "";
  if (!parentId) {
    redirect("/account/copy");
  }
  redirect(`/account/copy?copy=${encodeURIComponent(parentId)}`);
}
