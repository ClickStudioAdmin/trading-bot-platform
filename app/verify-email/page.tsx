import type { Metadata } from "next";
import { namedPageMetadata } from "@/lib/platform/metadata";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { confirmVerifyEmailAction } from "@/lib/auth/actions";
import { firstSearchValue } from "@/lib/paper/open";

export async function generateMetadata(): Promise<Metadata> {
  return namedPageMetadata(
    "Confirm email",
    (name) => `Confirm your ${name} email.`,
  );
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = firstSearchValue((await searchParams).token) ?? "";

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Confirm your email
      </h1>
      <p className="mt-3 text-sm text-ink-muted">
        Click the button to confirm this address. We do not confirm on open, so
        mail scanners cannot use the link for you.
      </p>
      <section className="mt-8 rounded-card border border-line bg-surface p-5">
        {!token ? (
          <p className="text-sm text-danger">
            That confirmation link is invalid or has expired.
          </p>
        ) : (
          <form action={confirmVerifyEmailAction}>
            <input type="hidden" name="token" value={token} />
            <PendingSubmitButton
              pendingLabel="Confirming…"
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              Confirm email
            </PendingSubmitButton>
          </form>
        )}
      </section>
    </main>
  );
}
