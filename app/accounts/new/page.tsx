import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { createTradingAccount } from "@/lib/accounts/actions";
import { getSessionContext } from "@/lib/auth/session";
import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "New account",
  description: "Create a Paper or Live trading account.",
};

export default async function NewAccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const params = await searchParams;
  const error = firstSearchValue(params.error);

  return (
    <main className="mx-auto max-w-xl px-6 pt-8 pb-8">
      <PageHeading title="New account" />
      <p className="-mt-4 mb-6 text-sm text-ink-muted">
        Paper and Live are separate books. Mode cannot change later. Nothing is
        copied from your current account.
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <form
        action={createTradingAccount}
        className="mt-6 space-y-4 rounded-card border border-line bg-surface p-5"
      >
        <label className="block text-xs text-ink-muted">
          Name
          <input
            name="name"
            required
            maxLength={40}
            className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          />
        </label>
        <label className="block text-xs text-ink-muted">
          Mode
          <select
            name="mode"
            defaultValue="paper"
            className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          >
            <option value="paper">Paper</option>
            <option value="live">Live</option>
          </select>
        </label>
        <p className="text-sm text-ink-muted">
          Live accounts can store their own rules. This app will not place
          exchange orders until live execution exists.
        </p>
        <button
          type="submit"
          className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          Create account
        </button>
      </form>
    </main>
  );
}
