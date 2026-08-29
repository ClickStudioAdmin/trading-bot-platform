import { AccountSidenav } from "@/components/account-sidenav";
import { listTradingAccounts } from "@/lib/accounts/store";
import { getSessionContext } from "@/lib/auth/session";

export async function AppSidenavShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionContext();
  if (!session) {
    return children;
  }
  const desks = await listTradingAccounts(session.member.id);
  return (
    <div className="flex flex-1">
      <AccountSidenav deskId={session.account.id} desks={desks} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
