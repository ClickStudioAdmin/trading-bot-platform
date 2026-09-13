"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AFFILIATE_ONLY_HEADER_LINKS,
  HEADER_LINKS,
  PUBLIC_NAV_LINKS,
  usesSignedInAppChrome,
} from "@/lib/site-links";

function navItemClass(active: boolean): string {
  return `rounded-control px-3 py-1.5 text-sm ${
    active
      ? "bg-surface-raised text-ink"
      : "text-ink-muted hover:bg-surface-raised hover:text-ink"
  }`;
}

export function HeaderChromeLinks({
  signedIn,
  platformMember = true,
}: {
  signedIn: boolean;
  platformMember?: boolean;
}) {
  const pathname = usePathname();
  if (usesSignedInAppChrome(pathname, signedIn)) {
    return signedIn ? (
      <HeaderBrowseLinks
        links={platformMember ? HEADER_LINKS : AFFILIATE_ONLY_HEADER_LINKS}
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
}: {
  links?: readonly { href: string; label: string }[];
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
            className={navItemClass(active)}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function HeaderAdminLink() {
  const pathname = usePathname();
  const active = pathname === "/admin" || pathname.startsWith("/admin/");
  return (
    <Link href="/admin" className={navItemClass(active)}>
      Admin
    </Link>
  );
}
