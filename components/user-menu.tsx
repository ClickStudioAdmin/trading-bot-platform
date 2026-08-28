"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { signOut } from "@/lib/auth/actions";

export function UserMenu({
  name,
  showAccountLinks = true,
}: {
  name: string | null;
  showAccountLinks?: boolean;
}) {
  const rootRef = useRef<HTMLDetailsElement>(null);

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

  if (!name) {
    return (
      <Link
        href="/sign-in"
        className="rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
      >
        Sign in
      </Link>
    );
  }

  const initial = name.slice(0, 1).toUpperCase();

  return (
    <details ref={rootRef} className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-control border border-line px-2 py-1 hover:bg-surface-raised [&::-webkit-details-marker]:hidden">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
          {initial}
        </span>
        <span className="hidden max-w-[10rem] truncate text-sm text-ink sm:inline">
          {name}
        </span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-56 rounded-card border border-line bg-surface p-2 shadow-none">
        {showAccountLinks ? (
          <>
            <Link
              href="/account/settings"
              className="block rounded-control px-2 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Settings
            </Link>
            <Link
              href="/account/exchanges"
              className="block rounded-control px-2 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Exchanges
            </Link>
            <Link
              href="/account/templates"
              className="block rounded-control px-2 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Templates
            </Link>
            <div className="my-1 border-t border-line" />
          </>
        ) : null}
        <form action={signOut}>
          <PendingSubmitButton
            pendingLabel="Signing out…"
            className="w-full rounded-control px-2 py-2 text-left text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
          >
            Sign out
          </PendingSubmitButton>
        </form>
      </div>
    </details>
  );
}
