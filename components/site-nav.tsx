"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { SITE_LINKS, STRATEGY_LINKS } from "@/lib/site-links";

export function SiteNav({
  className = "",
  extraLinks = [],
  stacked = false,
}: {
  className?: string;
  extraLinks?: { href: string; label: string }[];
  stacked?: boolean;
}) {
  const pathname = usePathname();
  const extra = extraLinks.filter((link) => link.href !== "/strategies");

  return (
    <nav className={className} aria-label="Primary">
      {stacked ? (
        <StackedStrategies pathname={pathname} />
      ) : (
        <StrategiesMenu pathname={pathname} />
      )}
      {extra.map((link) => {
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

function StrategiesMenu({ pathname }: { pathname: string }) {
  const rootRef = useRef<HTMLDetailsElement>(null);
  const open = pathname === "/strategies" || pathname.startsWith("/strategies/");

  useEffect(() => {
    if (rootRef.current) {
      rootRef.current.open = false;
    }
  }, [pathname]);

  useEffect(() => {
    function closeMenu() {
      if (rootRef.current) {
        rootRef.current.open = false;
      }
    }
    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (!root?.open) {
        return;
      }
      if (!root.contains(event.target as Node)) {
        closeMenu();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={rootRef} className="relative">
      <summary
        className={`flex cursor-pointer list-none items-center gap-1 ${navItemClass(open)} [&::-webkit-details-marker]:hidden`}
      >
        Strategies
        <svg
          viewBox="0 0 12 12"
          className="size-3 text-ink-faint"
          aria-hidden
        >
          <path
            d="M3 4.5 6 8l3-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="absolute left-0 z-30 mt-2 w-52 rounded-card border border-line bg-surface p-2">
        <Link
          href="/strategies"
          className={`block rounded-control px-2 py-2 text-sm ${
            pathname === "/strategies"
              ? "bg-surface-raised text-ink"
              : "text-ink-muted hover:bg-surface-raised hover:text-ink"
          }`}
        >
          All strategies
        </Link>
        {STRATEGY_LINKS.map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-control px-2 py-2 text-sm ${
                active
                  ? "bg-surface-raised text-ink"
                  : "text-ink-muted hover:bg-surface-raised hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </details>
  );
}

function StackedStrategies({ pathname }: { pathname: string }) {
  const indexActive = pathname === "/strategies";
  return (
    <>
      <Link href="/strategies" className={navItemClass(indexActive)}>
        {SITE_LINKS[0].label}
      </Link>
      {STRATEGY_LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`pl-5 ${navItemClass(active)}`}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

function navItemClass(active: boolean): string {
  return `rounded-control px-3 py-1.5 text-sm ${
    active
      ? "bg-surface-raised text-ink"
      : "text-ink-muted hover:bg-surface-raised hover:text-ink"
  }`;
}
