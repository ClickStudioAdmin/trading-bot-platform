"use client";

import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { signOut } from "@/lib/auth/actions";

export function UserMenu({ name }: { name: string | null }) {
  if (!name) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/sign-in"
          className="rounded-control px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
        >
          Join for Free
        </Link>
      </div>
    );
  }

  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className="group relative">
      <button
        type="button"
        className="flex items-center gap-2 rounded-control border border-line px-2 py-1 group-hover:bg-surface-raised group-focus-within:bg-surface-raised"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
          {initial}
        </span>
        <span className="hidden max-w-[10rem] truncate text-sm text-ink sm:inline">
          {name}
        </span>
      </button>
      <div className="invisible absolute right-0 z-20 pt-1 opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="w-56 rounded-card border border-line bg-surface p-2">
          <form action={signOut}>
            <PendingSubmitButton
              pendingLabel="Signing out…"
              className="w-full rounded-control px-2 py-2 text-left text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Sign out
            </PendingSubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
