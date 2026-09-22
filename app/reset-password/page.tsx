import type { Metadata } from "next";
import { namedPageMetadata } from "@/lib/platform/metadata";
import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { resetPasswordAction } from "@/lib/auth/actions";
import { FORGOT_PASSWORD_PATH } from "@/lib/auth/onboarding-path";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import { firstSearchValue } from "@/lib/paper/open";

export async function generateMetadata(): Promise<Metadata> {
  return namedPageMetadata(
    "Reset password",
    (name) => `Choose a new ${name} password.`,
  );
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = firstSearchValue(params.token) ?? "";
  const error = firstSearchValue(params.error);
  const missing = !token;

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Reset password
      </h1>
      <p className="mt-3 text-sm text-ink-muted">
        Choose a new password, then sign in.
      </p>
      <section className="mt-8 rounded-card border border-line bg-surface p-5">
        {error || missing ? (
          <p className="mb-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error || "That reset link is invalid or has expired."}
          </p>
        ) : null}
        {missing ? (
          <p className="text-sm text-ink-muted">
            <Link
              href={FORGOT_PASSWORD_PATH}
              className="text-accent hover:text-accent-strong"
            >
              Request a new reset link
            </Link>
            .
          </p>
        ) : (
          <form action={resetPasswordAction} className="space-y-3">
            <input type="hidden" name="token" value={token} />
            <label className="block text-sm text-ink" htmlFor="newPassword">
              New password
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className={BILLING_FIELD_CLASS}
              />
              <span className="mt-1 block text-hint text-ink-muted">
                At least 8 characters.
              </span>
            </label>
            <label className="block text-sm text-ink" htmlFor="confirmPassword">
              Confirm password
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className={BILLING_FIELD_CLASS}
              />
            </label>
            <PendingSubmitButton
              pendingLabel="Saving…"
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              Save password
            </PendingSubmitButton>
          </form>
        )}
        <p className="mt-4 text-sm text-ink-muted">
          <Link
            href={FORGOT_PASSWORD_PATH}
            className="text-accent hover:text-accent-strong"
          >
            Request a new link
          </Link>
          {" · "}
          <Link href="/sign-in" className="text-accent hover:text-accent-strong">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
