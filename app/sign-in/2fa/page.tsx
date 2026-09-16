import type { Metadata } from "next";
import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { completeSignIn2faAction } from "@/lib/auth/totp-actions";
import { redirectSignedInHome } from "@/lib/auth/onboarding";
import { getSignInChallengeUserId } from "@/lib/auth/session";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Authenticator code",
  description: "Enter your Google Authenticator code to finish signing in.",
};

export default async function SignIn2faPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await redirectSignedInHome();
  const challengeUserId = await getSignInChallengeUserId();
  if (!challengeUserId) {
    redirect("/sign-in");
  }

  const error = firstSearchValue((await searchParams).error);

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
        Desk
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Authenticator code
      </h1>
      <p className="mt-3 text-sm text-ink-muted">
        Open Google Authenticator and enter the 6-digit code. A recovery code
        also works once.
      </p>
      <section className="mt-8 rounded-card border border-line bg-surface p-5">
        {error ? (
          <p className="mb-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <form action={completeSignIn2faAction} className="space-y-3">
          <label className="block text-sm text-ink" htmlFor="code">
            Code
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              className={BILLING_FIELD_CLASS}
            />
          </label>
          <PendingSubmitButton
            pendingLabel="Checking…"
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            Continue
          </PendingSubmitButton>
        </form>
        <p className="mt-4 text-sm text-ink-muted">
          <Link href="/sign-in" className="text-accent hover:text-accent-strong">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
