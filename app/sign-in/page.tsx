import type { Metadata } from "next";
import Link from "next/link";
import { signIn } from "@/lib/auth/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { SIGN_IN_2FA_PATH } from "@/lib/auth/onboarding-path";
import { redirectSignedInHome } from "@/lib/auth/onboarding";
import { getSignInChallengeUserId } from "@/lib/auth/session";
import {
  AUTH_FORM_CARD_CLASS,
  AUTH_FORM_COLUMN_CLASS,
  BILLING_FIELD_CLASS,
} from "@/lib/membership/wallet-form";
import { redirect } from "next/navigation";

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
  if (await getSignInChallengeUserId()) {
    redirect(SIGN_IN_2FA_PATH);
  }

  const { error, verified, reset } = await searchParams;

  return (
      <main className="mx-auto w-full max-w-xl px-6 py-16">
        <div className={`mx-auto ${AUTH_FORM_COLUMN_CLASS}`}>
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Sign in to the trading platform or an affiliate account.
        </p>
        <section className={AUTH_FORM_CARD_CLASS}>
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
            .
          </p>
        </section>
        </div>
      </main>
  );
}
