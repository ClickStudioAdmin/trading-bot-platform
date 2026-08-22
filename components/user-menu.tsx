import Link from "next/link";
import { signOut } from "@/lib/auth/actions";

export function UserMenu({ email }: { email: string | null }) {
  if (!email) {
    return (
      <Link
        href="/sign-in"
        className="rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
      >
        Sign in
      </Link>
    );
  }

  const initial = email.slice(0, 1).toUpperCase();

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-control border border-line px-2 py-1 hover:bg-surface-raised [&::-webkit-details-marker]:hidden">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
          {initial}
        </span>
        <span className="hidden max-w-[12rem] truncate text-sm text-ink-muted sm:inline">
          {email}
        </span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-56 rounded-card border border-line bg-surface p-2 shadow-none">
        <p className="truncate px-2 py-2 text-xs text-ink-faint">{email}</p>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-control px-2 py-2 text-left text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
