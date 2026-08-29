import { pinDeskSearchParam } from "@/lib/accounts/guard";
import { getSessionContext } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  await pinDeskSearchParam(session);

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-7xl">{children}</div>
    </div>
  );
}
