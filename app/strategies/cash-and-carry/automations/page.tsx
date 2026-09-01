import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { AutomationsDesk } from "@/components/paper-rules-form";
import { PaperRulesGuide } from "@/components/paper-rules-guide";
import { loadPaperRules } from "@/lib/engine/load";
import { paperConfigToFormValues } from "@/lib/engine/rules";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { firstSearchValue } from "@/lib/paper/open";
import { getSessionContext } from "@/lib/auth/session";
import { memberIsAdmin } from "@/lib/admin/access";
import {
  listApplyableSets,
  listApplyableTemplates,
  templateToSummary,
} from "@/lib/templates/store";

export const metadata: Metadata = {
  title: "Automations (bots)",
  description: "Cash-and-carry bots.",
};

export default async function CashAndCarryAutomationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  const exchangeBook = Boolean(
    session && accountCanHoldConnections(session.account.mode),
  );
  const { signedIn, config, inUseRuleIds } = await loadPaperRules();
  const saved = firstSearchValue(params.saved) === "1";
  const reduceSaved = firstSearchValue(params.reduce) === "1";
  const error = firstSearchValue(params.error);
  const templates = session
    ? await listApplyableTemplates({
        userId: session.member.id,
        deskType: "cash_and_carry",
      })
    : [];
  const sets = session
    ? await listApplyableSets({
        userId: session.member.id,
        deskType: "cash_and_carry",
      })
    : [];

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Automations (bots)" />
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 text-sm text-success">Bots saved.</p>
      ) : null}
      {reduceSaved ? (
        <p className="mt-4 text-sm text-success">Reduce only saved.</p>
      ) : null}
      {signedIn && session ? (
        <AutomationsDesk
          values={paperConfigToFormValues(config)}
          inUseRuleIds={inUseRuleIds}
          reduceOnly={Boolean(config.reduceOnly)}
          isAdmin={memberIsAdmin(session.member)}
          accountId={session.account.id}
          templates={templates.map(templateToSummary)}
          sets={sets}
          recipeLibrary={templates}
        />
      ) : (
        <p className="text-sm text-ink-muted">
          <Link href="/sign-in" className="text-accent">
            Sign in
          </Link>{" "}
          to save automations.
        </p>
      )}
      <PaperRulesGuide exchangeBook={exchangeBook} />
    </main>
  );
}
