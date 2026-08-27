import type { Metadata } from "next";
import { signIn } from "@/lib/auth/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { deskHomePath } from "@/lib/accounts/model";
import { getSessionContext } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Desk sign-in for Trading Bot Platform.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSessionContext();
  if (session) {
    redirect(deskHomePath(session.account.deskType, session.account.id));
  }

  const { error } = await searchParams;

  return (
      <main className="mx-auto max-w-md px-6 py-16">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
          Desk
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Invite-only. Sign in with a desk member account. Market pages stay
          public.
        </p>
        {error ? (
          <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <form action={signIn} className="mt-8 space-y-4">
          <label className="block text-xs text-ink-muted" htmlFor="email">
            Email
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
            />
          </label>
          <label className="block text-xs text-ink-muted" htmlFor="password">
            Password
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
            />
          </label>
          <PendingSubmitButton
            pendingLabel="Signing in…"
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            Sign in
          </PendingSubmitButton>
        </form>
      </main>
  );
}
