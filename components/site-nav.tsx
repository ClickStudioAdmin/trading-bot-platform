"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_LINKS } from "@/lib/site-links";

export function SiteNav({
  className = "",
  extraLinks = [],
}: {
  className?: string;
  extraLinks?: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const links = [...SITE_LINKS, ...extraLinks];

  return (
    <nav className={className} aria-label="Primary">
      {links.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-control px-3 py-1.5 text-sm ${
              active
                ? "bg-surface-raised text-ink"
                : "text-ink-muted hover:bg-surface-raised hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
