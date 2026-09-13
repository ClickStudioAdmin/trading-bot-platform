import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { pinDeskSearchParam } from "@/lib/accounts/guard";
import { DESK_PATHNAME_HEADER } from "@/lib/accounts/model";
import { AFFILIATES_PATH } from "@/lib/auth/onboarding-path";
import { getSessionContext, getSessionMember } from "@/lib/auth/session";

function isAffiliateSettingsPath(pathname: string): boolean {
  return (
    pathname === "/account/settings" ||
    pathname.startsWith("/account/settings/")
  );
}

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionContext();
  if (session) {
    await pinDeskSearchParam(session);
    return (
      <div className="px-6 py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </div>
    );
  }

  const member = await getSessionMember();
  const pathname = (await headers()).get(DESK_PATHNAME_HEADER) ?? "";
  if (member && !member.platformMember && isAffiliateSettingsPath(pathname)) {
    return (
      <div className="px-6 py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </div>
    );
  }

  redirect(member ? AFFILIATES_PATH : "/sign-in");
}
