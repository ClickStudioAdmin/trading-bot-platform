import { SiteLogo } from "@/components/site-logo";
import { SiteNav } from "@/components/site-nav";
import { UserMenu } from "@/components/user-menu";
import { getAdminUser } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";

export async function SiteHeader() {
  const user = await getSessionMember();
  const admin = user ? await getAdminUser() : null;
  const extraLinks = admin ? [{ href: "/admin", label: "Admin" }] : [];

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <SiteLogo />
        <SiteNav
          className="hidden items-center gap-1 md:flex"
          extraLinks={extraLinks}
        />
        <div className="flex items-center gap-2">
          <details className="relative md:hidden">
            <summary className="list-none rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-card border border-line bg-surface p-2">
              <SiteNav className="flex flex-col gap-1" extraLinks={extraLinks} />
            </div>
          </details>
          <UserMenu email={user?.email ?? null} />
        </div>
      </div>
    </header>
  );
}
