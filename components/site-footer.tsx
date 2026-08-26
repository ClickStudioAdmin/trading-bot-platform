import Link from "next/link";
import { SITE_LINKS } from "@/lib/site-links";
import { SiteLogo } from "@/components/site-logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <SiteLogo />
          <p className="mt-3 max-w-sm text-sm text-ink-muted">
            Your strategies. Your keys. One desk.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">
            Desks
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/strategies" className="text-ink-muted hover:text-ink">
                {SITE_LINKS[0].label}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">
            Desk
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/sign-in" className="text-ink-muted hover:text-ink">
                Sign in
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-6 py-4 text-xs text-ink-faint">
          Trading Bot Platform · Development
        </p>
      </div>
    </footer>
  );
}
