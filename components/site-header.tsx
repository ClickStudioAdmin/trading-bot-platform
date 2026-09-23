import { Suspense } from "react";
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
  const platformMember = user?.platformMember === true;

  return (
    <HeaderBar
      signedIn={Boolean(user)}
      platformName={platformName}
      platformLogoUrl={platformLogoUrl}
      start={
        <Suspense
          fallback={
            <HeaderChromeLinks
              signedIn={Boolean(user)}
              platformMember={user?.platformMember !== false}
            />
          }
        >
          <HeaderStartLinks
            userId={user?.id ?? ""}
            platformMember={platformMember}
            verified={verified}
            signedIn={Boolean(user)}
          />
        </Suspense>
      }
      end={<UiPreferencesMenu />}
    >
      <div className="flex shrink-0 items-center justify-end gap-2">
        {verified && user ? (
          <Suspense fallback={null}>
            <HeaderInbox userId={user.id} platformMember={platformMember} />
          </Suspense>
        ) : null}
        <UserMenu
          name={user ? memberDisplayName(user.email, user.name) : null}
        />
      </div>
    </HeaderBar>
  );
}

async function HeaderStartLinks({
  userId,
  platformMember,
  verified,
  signedIn,
}: {
  userId: string;
  platformMember: boolean;
  verified: boolean;
  signedIn: boolean;
}) {
  const memberChrome =
    verified && userId
      ? await loadMemberNotificationChrome(userId, platformMember)
      : null;
  return (
    <HeaderChromeLinks
      signedIn={signedIn}
      platformMember={platformMember || !userId}
      badges={
        memberChrome
          ? { "/account/copy": memberChrome.actions.copyInvite }
          : undefined
      }
    />
  );
}

async function HeaderInbox({
  userId,
  platformMember,
}: {
  userId: string;
  platformMember: boolean;
}) {
  const memberChrome = await loadMemberNotificationChrome(
    userId,
    platformMember,
  );
  return <HeaderInboxLink count={memberChrome.inbox} />;
}
