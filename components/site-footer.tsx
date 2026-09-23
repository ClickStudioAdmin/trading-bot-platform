"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminTickButton } from "@/components/admin-tick-button";
import { SiteLogo } from "@/components/site-logo";
import { formatDeskType, type DeskType } from "@/lib/accounts/model";
import { usesSignedInAppChrome } from "@/lib/site-links";

export type FooterAdminChrome = {
  autoTick: boolean;
};

const FOOTER_DESKS: { id: string; deskType: DeskType }[] = [
  { id: "cash-and-carry", deskType: "cash_and_carry" },
  { id: "perps", deskType: "perps" },
  { id: "perps-bots", deskType: "perps_bots" },
  { id: "tradingview-strategy", deskType: "signal_follower" },
  { id: "dca", deskType: "dca" },
];

export function SiteFooter({
  appHref = null,
  signedIn = false,
  admin = null,
  platformName = "Trading Bot Platform",
  platformLogoUrl = null,
}: {
  appHref?: string | null;
  signedIn?: boolean;
  admin?: FooterAdminChrome | null;
  platformName?: string;
  platformLogoUrl?: string | null;
}) {
  const compact = usesSignedInAppChrome(usePathname(), signedIn);

  if (compact) {
    return (
      <footer className="mt-auto border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <p className="text-hint text-ink-faint">
            {platformName} · Development
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <FooterAdminTools admin={admin} />
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent hover:text-accent-strong"
            >
              Home (outside app)
            </a>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <SiteLogo name={platformName} logoUrl={platformLogoUrl} />
          <p className="mt-3 max-w-sm text-sm text-ink-muted">
            Your strategies. Your keys. One desk.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">
            Desks
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {FOOTER_DESKS.map((row) => (
              <li key={row.deskType}>
                <Link
                  href={`/#${row.id}`}
                  className="text-ink-muted hover:text-ink"
                >
                  {formatDeskType(row.deskType)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">
            Product
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/" className="text-ink-muted hover:text-ink">
                Home
              </Link>
            </li>
            <li>
              <Link href="/#how-it-works" className="text-ink-muted hover:text-ink">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/affiliates" className="text-ink-muted hover:text-ink">
                Affiliates
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="text-ink-muted hover:text-ink">
                Pricing
              </Link>
            </li>
            {appHref ? (
              <li>
                <Link
                  href={appHref}
                  className="text-ink-muted hover:text-ink"
                  target="_blank"
                  rel="noreferrer"
                >
                  Go to App
                </Link>
              </li>
            ) : (
              <>
                <li>
                  <Link href="/sign-up" className="text-ink-muted hover:text-ink">
                    Join for Free
                  </Link>
                </li>
                <li>
                  <Link href="/sign-in" className="text-ink-muted hover:text-ink">
                    Sign in
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <p className="text-hint text-ink-faint">
            {platformName} · Development
          </p>
          <FooterAdminTools admin={admin} />
        </div>
      </div>
    </footer>
  );
}

function FooterAdminTools({ admin }: { admin?: FooterAdminChrome | null }) {
  if (!admin) {
    return null;
  }
  return <AdminTickButton autoTick={admin.autoTick} notePlacement="above" />;
}
