import { AdminTickButton } from "@/components/admin-tick-button";
import { SiteLogo } from "@/components/site-logo";
import { HeaderAdminLink } from "@/components/site-nav";
import { UserMenu } from "@/components/user-menu";
import { listTradingAccounts } from "@/lib/accounts/store";
import { getAdminUser } from "@/lib/admin/access";
import { loadAutoTickEnabled } from "@/lib/admin/settings";
import { getSessionMember } from "@/lib/auth/session";
import { memberDisplayName } from "@/lib/members/sync";
import { connection } from "next/server";

export async function SiteHeader({
  hideLogo = false,
}: {
  hideLogo?: boolean;
}) {
  await connection();
  const user = await getSessionMember();
  const admin = user ? await getAdminUser() : null;
  const accounts = user ? await listTradingAccounts(user.id) : [];
  const autoTick = admin ? await loadAutoTickEnabled() : false;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-sm">
      <div
        className={`mx-auto flex max-w-7xl items-center gap-4 px-6 py-3 ${
          hideLogo ? "justify-end" : "justify-between"
        }`}
      >
        {hideLogo ? null : (
          <div className="min-w-0">
            <SiteLogo />
          </div>
        )}
        <div className="flex shrink-0 items-center justify-end gap-2">
          <UserMenu
            name={user ? memberDisplayName(user.email, user.name) : null}
            showAccountLinks={accounts.length > 0}
          />
          {admin && accounts.length > 0 ? <HeaderAdminLink /> : null}
          {admin && accounts.length > 0 ? (
            <AdminTickButton autoTick={autoTick} />
          ) : null}
        </div>
      </div>
    </header>
  );
}
