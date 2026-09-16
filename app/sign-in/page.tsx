import type { Metadata } from "next";
import Link from "next/link";
import { signIn } from "@/lib/auth/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { redirectSignedInHome } from "@/lib/auth/onboarding";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Desk sign-in for Trading Bot Platform.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; verified?: string; reset?: string }>;
}) {
  await redirectSignedInHome();

  const { error, verified, reset } = await searchParams;

  return (
      <main className="mx-auto max-w-md px-6 py-16">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
          Desk
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Sign in with a desk or affiliate account. Market pages stay public.
        </p>
        <section className="mt-8 rounded-card border border-line bg-surface p-5">
          {error ? (
            <p className="mb-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          ) : null}
          {verified === "1" ? (
            <p className="mb-4 rounded-card border border-line bg-surface-raised px-4 py-3 text-sm text-ink-muted">
              Email confirmed. Sign in to continue.
            </p>
          ) : null}
          {reset === "1" ? (
            <p className="mb-4 rounded-card border border-line bg-surface-raised px-4 py-3 text-sm text-ink-muted">
              Password saved. Sign in with the new password.
            </p>
          ) : null}
          <form action={signIn} className="space-y-3">
            <label className="block text-sm text-ink" htmlFor="email">
              Email
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={BILLING_FIELD_CLASS}
              />
            </label>
            <label className="block text-sm text-ink" htmlFor="password">
              Password
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={BILLING_FIELD_CLASS}
              />
            </label>
            <PendingSubmitButton
              pendingLabel="Signing in…"
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              Sign in
            </PendingSubmitButton>
          </form>
          <p className="mt-4 text-sm text-ink-muted">
            <Link
              href="/forgot-password"
              className="text-accent hover:text-accent-strong"
            >
              Forgot password
            </Link>
          </p>
          <p className="mt-4 text-sm text-ink-muted">
            New here?{" "}
            <Link href="/sign-up" className="text-accent hover:text-accent-strong">
              Create a free account
            </Link>
            . Promote the platform without desks?{" "}
            <Link href="/affiliates" className="text-accent hover:text-accent-strong">
              Join as an affiliate
            </Link>
            .
          </p>
        </section>
      </main>
  );
}
