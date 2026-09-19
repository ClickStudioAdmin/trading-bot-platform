import { HeaderBar } from "@/components/header-bar";
import { HeaderChromeLinks, HeaderInboxLink } from "@/components/site-nav";
import { UiPreferencesMenu } from "@/components/ui-preferences";
import { UserMenu } from "@/components/user-menu";
import { getSessionMember } from "@/lib/auth/session";
import { memberDisplayName } from "@/lib/members/sync";
import { loadMemberNotificationChrome } from "@/lib/notifications/badges";
import { connection } from "next/server";

export async function SiteHeader({
  platformName,
  platformLogoUrl,
}: {
  platformName?: string;
  platformLogoUrl?: string | null;
}) {
  await connection();
  const user = await getSessionMember();
  const verified = Boolean(user?.emailVerifiedAt);
  const memberChrome =
    verified && user
      ? await loadMemberNotificationChrome(user.id, user.platformMember)
      : null;

  return (
    <HeaderBar
      signedIn={Boolean(user)}
      platformName={platformName}
      platformLogoUrl={platformLogoUrl}
      start={
        <HeaderChromeLinks
          signedIn={Boolean(user)}
          platformMember={user?.platformMember !== false}
          badges={
            memberChrome
              ? { "/account/copy": memberChrome.actions.copyInvite }
              : undefined
          }
        />
      }
      end={<UiPreferencesMenu />}
    >
      <div className="flex shrink-0 items-center justify-end gap-2">
        {memberChrome ? <HeaderInboxLink count={memberChrome.inbox} /> : null}
        <UserMenu
          name={user ? memberDisplayName(user.email, user.name) : null}
        />
      </div>
    </HeaderBar>
  );
}
