import { AdminTickButton } from "@/components/admin-tick-button";
import { HeaderBar } from "@/components/header-bar";
import {
  HeaderAdminLink,
  HeaderChromeLinks,
  HeaderInboxLink,
} from "@/components/site-nav";
import { UserMenu } from "@/components/user-menu";
import { listTradingAccounts } from "@/lib/accounts/store";
import { getAdminUser } from "@/lib/admin/access";
import { loadAutoTickEnabled } from "@/lib/admin/settings";
import { getSessionMember } from "@/lib/auth/session";
import { memberDisplayName } from "@/lib/members/sync";
import {
  loadAdminNotificationChrome,
  loadMemberNotificationChrome,
} from "@/lib/notifications/badges";
import { connection } from "next/server";

export async function SiteHeader() {
  await connection();
  const user = await getSessionMember();
  const admin = user ? await getAdminUser() : null;
  const accounts = user ? await listTradingAccounts(user.id) : [];
  const autoTick = admin ? await loadAutoTickEnabled() : false;
  const memberChrome = user
    ? await loadMemberNotificationChrome(user.id, user.platformMember)
    : null;
  const adminChrome = admin ? await loadAdminNotificationChrome() : null;

  return (
    <HeaderBar
      signedIn={Boolean(user)}
      start={
        <HeaderChromeLinks
          signedIn={Boolean(user)}
          platformMember={user?.platformMember !== false}
        />
      }
    >
      <div className="flex shrink-0 items-center justify-end gap-2">
        {memberChrome ? <HeaderInboxLink count={memberChrome.inbox} /> : null}
        <UserMenu
          name={user ? memberDisplayName(user.email, user.name) : null}
        />
        {admin && accounts.length > 0 ? (
          <HeaderAdminLink count={adminChrome?.header ?? 0} />
        ) : null}
        {admin && accounts.length > 0 ? (
          <AdminTickButton autoTick={autoTick} />
        ) : null}
      </div>
    </HeaderBar>
  );
}
