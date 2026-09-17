import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { resendVerifyEmailAction } from "@/lib/auth/actions";
import { signedInHomePath } from "@/lib/auth/onboarding";
import { getSessionMember } from "@/lib/auth/session";
import { listTradingAccounts } from "@/lib/accounts/store";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "Check your email",
  description: "Confirm your email to use Trading Bot Platform.",
};

export default async function VerifyAccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  if (member.emailVerifiedAt) {
    redirect(signedInHomePath(member, await listTradingAccounts(member.id)));
  }
  const params = await searchParams;
  const error = firstSearchValue(params.error);
  const sent = firstSearchValue(params.sent) === "1";

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Check your email
      </h1>
      <p className="mt-3 text-sm text-ink-muted">
        We sent a confirmation link to{" "}
        <span className="text-ink">{member.email}</span>. Confirm that address
        before you use the app.
      </p>
      <section className="mt-8 rounded-card border border-line bg-surface p-5">
        {error ? (
          <p className="mb-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {sent ? (
          <p className="mb-4 rounded-card border border-line bg-surface-raised px-4 py-3 text-sm text-ink-muted">
            If a message is already on the way, wait a couple of minutes before
            asking again.
          </p>
        ) : null}
        <form action={resendVerifyEmailAction}>
          <PendingSubmitButton
            pendingLabel="Sending…"
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            Resend confirmation
          </PendingSubmitButton>
        </form>
        <p className="mt-4 text-sm text-ink-muted">
          Wrong account?{" "}
          <Link href="/sign-in" className="text-accent hover:text-accent-strong">
            Sign in
          </Link>{" "}
          with a different email, or{" "}
          <Link
            href="/forgot-password"
            className="text-accent hover:text-accent-strong"
          >
            reset your password
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
