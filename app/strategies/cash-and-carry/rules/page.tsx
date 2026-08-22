import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { PaperRulesForm } from "@/components/paper-rules-form";
import { loadPaperRules } from "@/lib/engine/load";
import { paperRulesToFormValues } from "@/lib/engine/rules";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "Rules",
  description: "Paper cash-and-carry execution rules.",
};

export default async function PaperRulesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { signedIn, rules } = await loadPaperRules();
  const saved = firstSearchValue(params.saved) === "1";
  const error = firstSearchValue(params.error);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeading overline="Strategies · Cash and carry" title="Rules" />
      <p className="-mt-4 text-sm text-ink-muted">
        These rules drive the paper engine only. No Bybit order is sent.
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 text-sm text-success">Rules saved.</p>
      ) : null}
      {signedIn ? (
        <div className="mt-6">
          <PaperRulesForm values={paperRulesToFormValues(rules)} />
        </div>
      ) : (
        <p className="mt-6 text-sm text-ink-muted">
          <Link href="/sign-in" className="text-accent">
            Sign in
          </Link>{" "}
          to save paper engine rules.
        </p>
      )}
    </main>
  );
}
