import { AccountSidenav } from "@/components/account-sidenav";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DESK_PATHNAME_HEADER } from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import { getSessionContext } from "@/lib/auth/session";
import { headers } from "next/headers";

export async function AppFrame({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext();
  const pathname = (await headers()).get(DESK_PATHNAME_HEADER) ?? "";
  const showDeskSidebar =
    Boolean(session) &&
    (pathname.startsWith("/account") || pathname.startsWith("/strategies"));
  const desks =
    showDeskSidebar && session
      ? await listTradingAccounts(session.member.id)
      : [];

  const main = (
    <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
      <SiteHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </div>
  );

  if (!showDeskSidebar || !session) {
    return main;
  }

  return (
    <div className="flex min-h-dvh">
      <AccountSidenav deskId={session.account.id} desks={desks} />
      {main}
    </div>
  );
}
