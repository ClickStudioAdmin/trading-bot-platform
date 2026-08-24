import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { PaperRulesForm } from "@/components/paper-rules-form";
import { PaperRulesGuide } from "@/components/paper-rules-guide";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { saveAccountReduceOnly } from "@/lib/engine/actions";
import { loadPaperRules } from "@/lib/engine/load";
import { paperConfigToFormValues } from "@/lib/engine/rules";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "Automations",
  description: "Paper cash-and-carry automation rules.",
};

export default async function CashAndCarryAutomationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { signedIn, config, inUseRuleIds } = await loadPaperRules();
  const saved = firstSearchValue(params.saved) === "1";
  const reduceSaved = firstSearchValue(params.reduce) === "1";
  const error = firstSearchValue(params.error);

  return (
    <main className="mx-auto max-w-6xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Automations" />
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 text-sm text-success">Automations saved.</p>
      ) : null}
      {reduceSaved ? (
        <p className="mt-4 text-sm text-success">Reduce only saved.</p>
      ) : null}
      {signedIn ? (
        <div className="space-y-4">
          <form
            action={saveAccountReduceOnly}
            className="max-w-md space-y-3 rounded-card border border-line bg-surface p-5"
          >
            <label className="flex items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                name="reduceOnly"
                value="on"
                defaultChecked={Boolean(config.reduceOnly)}
                className="mt-1 size-4"
              />
              <span>
                Reduce only
                <span className="mt-1 block text-xs text-ink-muted">
                  Stops every set from opening or adding size. Automated
                  exits still run unless a set is Disabled. Manual Open,
                  Close, and Unwind still work.
                </span>
              </span>
            </label>
            <PendingSubmitButton
              pendingLabel="Saving…"
              successKey="save-reduce-only"
              className="rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink"
            >
              Save
            </PendingSubmitButton>
          </form>
          <PaperRulesForm
            values={paperConfigToFormValues(config)}
            inUseRuleIds={inUseRuleIds}
            reduceOnly={Boolean(config.reduceOnly)}
          />
        </div>
      ) : (
        <p className="text-sm text-ink-muted">
          <Link href="/sign-in" className="text-accent">
            Sign in
          </Link>{" "}
          to save automations.
        </p>
      )}
      <PaperRulesGuide />
    </main>
  );
}
