"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_LINKS } from "@/lib/site-links";

export function SiteNav({
  className = "",
}: {
  className?: string;
  stacked?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === "/strategies" || pathname.startsWith("/strategies/");

  return (
    <nav className={className} aria-label="Primary">
      <Link href="/strategies" className={navItemClass(active)}>
        {SITE_LINKS[0].label}
      </Link>
    </nav>
  );
}

function navItemClass(active: boolean): string {
  return `rounded-control px-3 py-1.5 text-sm ${
    active
      ? "bg-surface-raised text-ink"
      : "text-ink-muted hover:bg-surface-raised hover:text-ink"
  }`;
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
