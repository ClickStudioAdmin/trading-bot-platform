import type { Metadata } from "next";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  cancelSignIn2faAction,
  completeSignIn2faAction,
} from "@/lib/auth/totp-actions";
import { redirectSignedInHome } from "@/lib/auth/onboarding";
import { getSignInChallengeUserId } from "@/lib/auth/session";
import {
  AUTH_FORM_COLUMN_CLASS,
  BILLING_FIELD_CLASS,
} from "@/lib/membership/wallet-form";
import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Two-factor authentication (2FA)",
  description: "Enter your two-factor authentication code to finish signing in.",
};

const cancelClass =
  "shrink-0 rounded-control px-1.5 py-0.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink";

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
      <section
        className={`mx-auto rounded-card border border-line bg-surface-raised p-5 ${AUTH_FORM_COLUMN_CLASS}`}
      >
        <h1 className="text-lg font-semibold text-ink">
          Two-factor authentication (2FA)
        </h1>
        <form id="cancel-sign-in-2fa" action={cancelSignIn2faAction} hidden />
        <form action={completeSignIn2faAction}>
          <label className="mt-4 block text-sm text-ink" htmlFor="code">
            Authenticator code
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              className={BILLING_FIELD_CLASS}
            />
            <span className="mt-1 block text-hint text-ink-muted">
              Open Google Authenticator and enter the 6-digit code. A recovery
              code also works once.
            </span>
          </label>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <div className="mt-5 flex items-center justify-end gap-3">
            <button type="submit" form="cancel-sign-in-2fa" className={cancelClass}>
              Back to sign in
            </button>
            <PendingSubmitButton
              pendingLabel="Checking…"
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent"
            >
              Continue
            </PendingSubmitButton>
          </div>
        </form>
      </section>
    </main>
  );
}
