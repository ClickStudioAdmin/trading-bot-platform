import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { getAuthUser } from "@/lib/supabase/server";

export async function SessionBar() {
  const user = await getAuthUser();

  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-6 py-2 text-sm">
        {user ? (
          <form action={signOut} className="flex items-center gap-3">
            <span className="truncate text-ink-muted">{user.email}</span>
            <button
              type="submit"
              className="rounded-control border border-line px-2.5 py-1 text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Sign out
            </button>
          </form>
        ) : (
          <Link
            href="/sign-in"
            className="text-ink-muted hover:text-ink"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
