import { AccountSidenav } from "@/components/account-sidenav";
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

  return (
    <div className="flex flex-1">
      <AccountSidenav bookName={session.account.name} />
      <div className="min-w-0 flex-1 px-6 py-8">
        <div className="mx-auto max-w-3xl">{children}</div>
      </div>
    </div>
  );
}
