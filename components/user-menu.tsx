"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconUser } from "@/components/icons";
import { NavBadge } from "@/components/nav-badge";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { HEADER_CHIP_CLASS } from "@/components/site-nav";
import { signOut } from "@/lib/auth/actions";

export function UserMenu({
  name,
  isAdmin = false,
  alertCount = 0,
}: {
  name: string | null;
  isAdmin?: boolean;
  alertCount?: number;
}) {
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

  return (
    <div className="group relative">
      <button
        type="button"
        className={`${HEADER_CHIP_CLASS} text-ink group-hover:bg-surface-raised group-focus-within:bg-surface-raised`}
      >
        <IconUser size={16} className="size-4 shrink-0" />
        <span className="hidden max-w-[10rem] truncate sm:inline">
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
          {isAdmin ? <AdminMenuLink count={alertCount} /> : null}
        </div>
      </div>
    </div>
  );
}

function AdminMenuLink({ count }: { count: number }) {
  const pathname = usePathname();
  const active = pathname === "/admin" || pathname.startsWith("/admin/");
  return (
    <Link
      href="/admin"
      className={`mt-0.5 flex w-full items-center justify-between gap-2 rounded-control px-2 py-2 text-left text-sm hover:bg-surface-raised hover:text-ink ${
        active ? "bg-surface-raised text-ink" : "text-ink-muted"
      }`}
    >
      <span>Admin</span>
      <NavBadge count={count} />
    </Link>
  );
}
