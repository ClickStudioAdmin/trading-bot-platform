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
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:flex-row lg:gap-10">
      <AccountSidenav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
