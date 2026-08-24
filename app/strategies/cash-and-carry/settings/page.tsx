import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { savePaperSettings } from "@/lib/engine/actions";
import { loadUsableBookShare } from "@/lib/engine/settings";
import { usableBookShareToInput } from "@/lib/opportunities/capacity";
import { firstSearchValue } from "@/lib/paper/open";
import { getSessionMember } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Settings",
  description: "Cash-and-carry strategy settings.",
};

export default async function CashAndCarrySettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getSessionMember();
  const share = await loadUsableBookShare();
  const saved = firstSearchValue(params.saved) === "1";
  const error = firstSearchValue(params.error);

  return (
    <main className="mx-auto max-w-6xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Settings" />
      <p className="-mt-4 text-sm text-ink-muted">
        Strategy-wide knobs. Automations stay on their own page.
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 text-sm text-success">Settings saved.</p>
      ) : null}
      {user ? (
        <form
          action={savePaperSettings}
          className="mt-6 max-w-md space-y-4 rounded-card border border-line bg-surface p-5"
        >
          <label className="block text-sm text-ink">
            Usable book share %
            <input
              name="usableBookShare"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={usableBookShareToInput(share)}
              className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
            />
          </label>
          <p className="text-xs text-ink-muted">
            Percent of the top 5 book levels inside 5 bp of impact. 25 means
            a quarter of that in-range book. Manual Size, Dynamic clips, and
            Dynamic exits all use this number.
          </p>
          <PendingSubmitButton
            pendingLabel="Saving…"
            className="rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink"
          >
            Save settings
          </PendingSubmitButton>
        </form>
      ) : (
        <p className="mt-6 text-sm text-ink-muted">
          <Link href="/sign-in" className="text-accent">
            Sign in
          </Link>{" "}
          to change strategy settings.
        </p>
      )}
    </main>
  );
}
