import type { Metadata } from "next";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  cancelSignIn2faAction,
  completeSignIn2faAction,
} from "@/lib/auth/totp-actions";
import { redirectSignedInHome } from "@/lib/auth/onboarding";
import { getSignInChallengeUserId } from "@/lib/auth/session";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Two-factor authentication (2FA)",
  description: "Enter your two-factor authentication code to finish signing in.",
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
    <main className="mx-auto w-full max-w-xl px-6 py-16">
      <h1 className="whitespace-nowrap text-3xl font-semibold tracking-tight">
        Two-factor authentication (2FA)
      </h1>
      <p className="mt-3 max-w-md text-sm text-ink-muted">
        Open Google Authenticator and enter the 6-digit code. A recovery code
        also works once.
      </p>
      <section className="mt-8 max-w-md rounded-card border border-line bg-surface p-5">
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
        <form action={cancelSignIn2faAction} className="mt-4">
          <button
            type="submit"
            className="text-sm text-accent hover:text-accent-strong"
          >
            Back to sign in
          </button>
        </form>
      </section>
    </main>
  );
}
