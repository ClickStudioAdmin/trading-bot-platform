import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { pinDeskSearchParam } from "@/lib/accounts/guard";
import { DESK_PATHNAME_HEADER } from "@/lib/accounts/model";
import { AFFILIATES_PATH, VERIFY_PATH } from "@/lib/auth/onboarding-path";
import { getSessionContext, getSessionMember } from "@/lib/auth/session";

function isAffiliateAccountPath(pathname: string): boolean {
  return (
    pathname === "/account/settings" ||
    pathname.startsWith("/account/settings/") ||
    pathname === "/account/notifications" ||
    pathname.startsWith("/account/notifications/")
  );
}

function isVerifyPath(pathname: string): boolean {
  return pathname === VERIFY_PATH || pathname.startsWith(`${VERIFY_PATH}/`);
}

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get(DESK_PATHNAME_HEADER) ?? "";
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  if (isVerifyPath(pathname)) {
    return children;
  }
  if (!member.emailVerifiedAt) {
    redirect(VERIFY_PATH);
  }

  const session = await getSessionContext();
  if (session) {
    await pinDeskSearchParam(session);
    return (
      <div className="px-6 py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </div>
    );
  }

  if (!member.platformMember && isAffiliateAccountPath(pathname)) {
    return (
      <div className="px-6 py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </div>
    );
  }

  if (member.platformMember) {
    return (
      <div className="px-6 py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </div>
    );
  }

  redirect(AFFILIATES_PATH);
}
