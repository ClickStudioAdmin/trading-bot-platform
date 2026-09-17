import type { Metadata } from "next";
import { namedPageMetadata } from "@/lib/platform/metadata";
import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { AUTH_MAIL_ALWAYS_OK } from "@/lib/auth/email";
import { redirectSignedInHome } from "@/lib/auth/onboarding";
import { getSessionMember } from "@/lib/auth/session";
import {
  AUTH_FORM_CARD_CLASS,
  AUTH_FORM_COLUMN_CLASS,
  BILLING_FIELD_CLASS,
} from "@/lib/membership/wallet-form";
import { firstSearchValue } from "@/lib/paper/open";

export async function generateMetadata(): Promise<Metadata> {
  return namedPageMetadata(
    "Forgot password",
    (name) => `Reset your ${name} password.`,
  );
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await getSessionMember();
  if (member?.emailVerifiedAt) {
    await redirectSignedInHome();
  }

  const params = await searchParams;
  const error = firstSearchValue(params.error);
  const sent = firstSearchValue(params.sent) === "1";

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-16">
      <div className={`mx-auto ${AUTH_FORM_COLUMN_CLASS}`}>
      <h1 className="text-3xl font-semibold tracking-tight">
        Forgot password
      </h1>
      <p className="mt-3 text-sm text-ink-muted">
        Enter the email on the login. We send a reset link if that account
        exists.
      </p>
      <section className={AUTH_FORM_CARD_CLASS}>
        {error ? (
          <p className="mb-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {sent ? (
          <p className="mb-4 rounded-card border border-line bg-surface-raised px-4 py-3 text-sm text-ink-muted">
            {AUTH_MAIL_ALWAYS_OK}
          </p>
        ) : null}
        <form action={requestPasswordResetAction} className="space-y-3">
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
          <PendingSubmitButton
            pendingLabel="Sending…"
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            Send reset link
          </PendingSubmitButton>
        </form>
        <p className="mt-4 text-sm text-ink-muted">
          Remembered it?{" "}
          <Link href="/sign-in" className="text-accent hover:text-accent-strong">
            Sign in
          </Link>
          .
        </p>
      </section>
      </div>
    </main>
  );
}
