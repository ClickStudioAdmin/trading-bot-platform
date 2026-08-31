import { AdminTickButton } from "@/components/admin-tick-button";
import { HeaderBar } from "@/components/header-bar";
import { HeaderAdminLink, HeaderBrowseLinks } from "@/components/site-nav";
import { UserMenu } from "@/components/user-menu";
import { listTradingAccounts } from "@/lib/accounts/store";
import { getAdminUser } from "@/lib/admin/access";
import { loadAutoTickEnabled } from "@/lib/admin/settings";
import { getSessionMember } from "@/lib/auth/session";
import { memberDisplayName } from "@/lib/members/sync";
import { connection } from "next/server";

export async function SiteHeader() {
  await connection();
  const user = await getSessionMember();
  const admin = user ? await getAdminUser() : null;
  const accounts = user ? await listTradingAccounts(user.id) : [];
  const autoTick = admin ? await loadAutoTickEnabled() : false;

  return (
    <HeaderBar start={user ? <HeaderBrowseLinks /> : null}>
      <div className="flex shrink-0 items-center justify-end gap-2">
        <UserMenu
          name={user ? memberDisplayName(user.email, user.name) : null}
        />
        {admin && accounts.length > 0 ? <HeaderAdminLink /> : null}
        {admin && accounts.length > 0 ? (
          <AdminTickButton autoTick={autoTick} />
        ) : null}
      </div>
    </HeaderBar>
  );
}
