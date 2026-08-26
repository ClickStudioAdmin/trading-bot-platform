import { AdminTickButton } from "@/components/admin-tick-button";
import { DeskSwitcher } from "@/components/desk-switcher";
import { SiteLogo } from "@/components/site-logo";
import { HeaderAdminLink } from "@/components/site-nav";
import { UserMenu } from "@/components/user-menu";
import { listTradingAccounts } from "@/lib/accounts/store";
import { getAdminUser } from "@/lib/admin/access";
import { loadAutoTickEnabled } from "@/lib/admin/settings";
import { getSessionContext, getSessionMember } from "@/lib/auth/session";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { memberDisplayName } from "@/lib/members/sync";
import { connection } from "next/server";

export async function SiteHeader() {
  await connection();
  const user = await getSessionMember();
  const session = user ? await getSessionContext() : null;
  const admin = user ? await getAdminUser() : null;
  const accounts = user ? await listTradingAccounts(user.id) : [];
  const connections = user ? await listExchangeConnections(user.id) : [];
  const autoTick = admin ? await loadAutoTickEnabled() : false;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-sm">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-3">
        <div className="min-w-0 justify-self-start">
          <SiteLogo />
        </div>
        <div className="justify-self-center">
          {session ? (
            <DeskSwitcher
              current={session.account}
              desks={accounts}
              connections={connections}
            />
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 justify-self-end">
          <UserMenu
            name={user ? memberDisplayName(user.email, user.name) : null}
          />
          {admin ? <HeaderAdminLink /> : null}
          {admin ? <AdminTickButton autoTick={autoTick} /> : null}
        </div>
      </div>
    </header>
  );
}
