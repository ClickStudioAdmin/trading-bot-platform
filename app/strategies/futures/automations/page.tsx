import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { FuturesAutomationsDesk } from "@/components/futures-rules-form";
import { FuturesRulesGuide } from "@/components/futures-rules-guide";
import { getSessionContext } from "@/lib/auth/session";
import { loadUsdtLinearPerps } from "@/lib/exchanges/bybit/perp";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { futuresRuleToForm } from "@/lib/futures/automation";
import { loadFuturesAutomationRules } from "@/lib/futures/automation-load";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { futuresWebhookOrigin } from "@/lib/futures/webhook";
import { listFuturesWebhooks } from "@/lib/futures/webhook-load";
import { headers } from "next/headers";
import { firstSearchValue } from "@/lib/paper/open";
import { FUTURES_PATHS } from "@/lib/strategies/registry";

export const metadata: Metadata = {
  title: "Futures automations",
  description: "Alert rules for USDT linear perpetuals.",
};

export default async function FuturesAutomationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  const settings = session ? await loadFuturesSettings(session.account.id) : null;
  const rules = session ? await loadFuturesAutomationRules(session.account.id) : [];
  const triggerWebhooks = session
    ? (
        await listFuturesWebhooks({
          accountId: session.account.id,
          origin: futuresWebhookOrigin(await headers()),
        })
      ).filter((row) => row.kind === "signal")
    : [];
  const pairs = await loadUsdtLinearPerps().catch(() => []);
  const exchangeBook = Boolean(
    session && accountCanHoldConnections(session.account.mode),
  );
  const saved = firstSearchValue(params.saved) === "1";
  const error = firstSearchValue(params.error);

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Automations" />
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 text-sm text-success">Automations saved.</p>
      ) : null}
      {settings?.reduceOnly ? (
        <p className="mt-4 mb-4 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Reduce only is on. Buy and Sell stay blocked until you turn it off in{" "}
          <Link href={FUTURES_PATHS.settings} className="underline">
            Strategy Settings
          </Link>
          .
        </p>
      ) : null}
      {session ? (
        <FuturesAutomationsDesk
          rules={rules.map(futuresRuleToForm)}
          options={pairs}
          triggerWebhooks={triggerWebhooks}
          reduceOnly={Boolean(settings?.reduceOnly)}
        />
      ) : (
        <p className="text-sm text-ink-muted">
          <Link href="/sign-in" className="text-accent">
            Sign in
          </Link>{" "}
          to save automations.
        </p>
      )}
      <FuturesRulesGuide exchangeBook={exchangeBook} />
    </main>
  );
}
