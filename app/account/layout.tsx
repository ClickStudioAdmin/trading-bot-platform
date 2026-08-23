import { AccountSidenav } from "@/components/account-sidenav";
import { getSessionMember } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionMember();
  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="flex flex-1">
      <AccountSidenav />
      <div className="min-w-0 flex-1 px-6 py-8">
        <div className="mx-auto max-w-3xl">{children}</div>
      </div>
    </div>
  );
}
