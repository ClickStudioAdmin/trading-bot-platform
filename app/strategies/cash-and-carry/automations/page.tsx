import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { PaperRulesForm } from "@/components/paper-rules-form";
import { PaperRulesGuide } from "@/components/paper-rules-guide";
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
  const { signedIn, config } = await loadPaperRules();
  const saved = firstSearchValue(params.saved) === "1";
  const error = firstSearchValue(params.error);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeading overline="Strategies · Cash and carry" title="Automations" />
      <p className="-mt-4 text-sm text-ink-muted">
        Stack entry layers by min APR and size. The engine uses the highest
        matching layer. Paper only — no Bybit order.
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 text-sm text-success">Automations saved.</p>
      ) : null}
      {signedIn ? (
        <div className="mt-6">
          <PaperRulesForm values={paperConfigToFormValues(config)} />
        </div>
      ) : (
        <p className="mt-6 text-sm text-ink-muted">
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
