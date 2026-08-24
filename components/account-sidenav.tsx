"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ACCOUNT_BOOK_LINKS,
  ACCOUNT_DESK_LINKS,
} from "@/lib/site-links";

export function AccountSidenav({ bookName }: { bookName: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-line bg-surface px-5 py-6">
      <NavGroup
        label="Desk"
        ariaLabel="Desk"
        links={ACCOUNT_DESK_LINKS}
        pathname={pathname}
      />
      <NavGroup
        className="mt-6"
        label={bookName}
        ariaLabel={bookName}
        links={ACCOUNT_BOOK_LINKS}
        pathname={pathname}
      />
    </aside>
  );
}

function NavGroup({
  label,
  ariaLabel,
  links,
  pathname,
  className,
}: {
  label: string;
  ariaLabel: string;
  links: readonly { href: string; label: string; exact?: boolean }[];
  pathname: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p
        className="truncate text-xs font-medium uppercase tracking-[0.16em] text-accent"
        title={label}
      >
        {label}
      </p>
      <nav aria-label={ariaLabel} className="mt-3 flex flex-col gap-1">
        {links.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-control px-3 py-2 text-sm ${
                active
                  ? "bg-surface-raised text-ink"
                  : "text-ink-faint hover:bg-surface-raised hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
