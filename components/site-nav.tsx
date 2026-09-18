"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconAffiliates,
  IconBacktest,
  IconBilling,
  IconCopyTrading,
  IconDesks,
  IconInbox,
  IconOverview,
  IconPlans,
  IconProfile,
  IconTemplates,
} from "@/components/icons";
import { NavBadge } from "@/components/nav-badge";
import {
  AFFILIATE_ONLY_HEADER_LINKS,
  HEADER_LINKS,
  PUBLIC_NAV_LINKS,
  usesSignedInAppChrome,
} from "@/lib/site-links";

const NAV_ICON = { size: 16, className: "size-4 shrink-0" } as const;

const NAV_ICONS = {
  "/account": IconOverview,
  "/account/copy": IconCopyTrading,
  "/account/backtests": IconBacktest,
  "/account/plans": IconPlans,
  "/account/settings": IconProfile,
  "/account/billing": IconBilling,
  "/account/sub-accounts": IconDesks,
  "/account/templates": IconTemplates,
  "/affiliates": IconAffiliates,
} as const;

export function NavItemIcon({ href }: { href: string }) {
  const Icon = NAV_ICONS[href as keyof typeof NAV_ICONS];
  if (!Icon) {
    return null;
  }
  return <Icon {...NAV_ICON} />;
}

export const NAV_IDLE_CLASS =
  "text-ink/60 hover:bg-surface-raised hover:text-ink";

function navItemClass(active: boolean): string {
  return `rounded-control px-3 py-1.5 text-sm ${
    active ? "bg-surface-raised text-ink" : NAV_IDLE_CLASS
  }`;
}

export const HEADER_CHIP_CLASS =
  "inline-flex items-center gap-2 rounded-control border border-line px-2.5 py-1 text-sm";

export function HeaderChromeLinks({
  signedIn,
  platformMember = true,
  badges = {},
}: {
  signedIn: boolean;
  platformMember?: boolean;
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  if (usesSignedInAppChrome(pathname, signedIn)) {
    return signedIn ? (
      <HeaderBrowseLinks
        links={platformMember ? HEADER_LINKS : AFFILIATE_ONLY_HEADER_LINKS}
        badges={badges}
      />
    ) : null;
  }
  return <HeaderPublicLinks />;
}

export function HeaderPublicLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Site" className="flex items-center gap-1">
      {PUBLIC_NAV_LINKS.map((link) => {
        const [pathPart] = link.href.split("#");
        const path = pathPart || "/";
        const hashLink = link.href.includes("#");
        const active = hashLink
          ? false
          : link.exact
            ? pathname === path
            : pathname === path || pathname.startsWith(`${path}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={navItemClass(active)}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function HeaderBrowseLinks({
  links = HEADER_LINKS,
  badges = {},
}: {
  links?: readonly { href: string; label: string }[];
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Browse" className="flex items-center gap-1">
      {links.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`${navItemClass(active)} inline-flex items-center gap-2`}
          >
            <NavItemIcon href={link.href} />
            {link.label}
            <NavBadge count={badges[link.href] ?? 0} />
          </Link>
        );
      })}
    </nav>
  );
}

export function HeaderAdminLink({ count = 0 }: { count?: number }) {
  const pathname = usePathname();
  const active = pathname === "/admin" || pathname.startsWith("/admin/");
  return (
    <Link href="/admin" className={`${navItemClass(active)} flex items-center gap-2`}>
      <span>Admin</span>
      <NavBadge count={count} />
    </Link>
  );
}

export function HeaderInboxLink({ count = 0 }: { count?: number }) {
  const pathname = usePathname();
  const active =
    pathname === "/account/notifications" ||
    pathname.startsWith("/account/notifications/");
  return (
    <Link
      href="/account/notifications"
      className={`${HEADER_CHIP_CLASS} ${
        active
          ? "bg-surface-raised text-ink"
          : NAV_IDLE_CLASS
      }`}
    >
      <IconInbox {...NAV_ICON} />
      <span>Inbox</span>
      <NavBadge count={count} />
    </Link>
  );
}
