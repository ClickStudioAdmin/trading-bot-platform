import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { DcaPlaybookForm } from "@/components/dca-playbook-form";
import { FuturesAutomationsDesk } from "@/components/futures-rules-form";
import { FuturesRulesGuide } from "@/components/futures-rules-guide";
import { loadDcaPlaybook } from "@/lib/dca/store";
import { getSessionContext } from "@/lib/auth/session";
import { loadUsdtLinearPerps } from "@/lib/exchanges/bybit/perp";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { futuresRuleToForm } from "@/lib/futures/automation";
import {
  listFuturesAutomationRuleIdsInUse,
  loadFuturesAutomationRules,
} from "@/lib/futures/automation-load";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { futuresWebhookOrigin } from "@/lib/futures/webhook";
import { listFuturesWebhooks } from "@/lib/futures/webhook-load";
import { headers } from "next/headers";
import { firstSearchValue } from "@/lib/paper/open";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { redirect } from "next/navigation";

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
  if (session?.account.deskType === "signal_follower") {
    redirect(FUTURES_PATHS.webhooks);
  }
  if (session?.account.deskType === "dca") {
    const playbook = await loadDcaPlaybook(session.account.id);
    const settings = await loadFuturesSettings(session.account.id);
    const pairs = await loadUsdtLinearPerps().catch(() => []);
    const saved = firstSearchValue(params.saved) === "1";
    const error = firstSearchValue(params.error);
    const notice = firstSearchValue(params.notice);
    return (
      <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
        <PageHeading as="h2" title="Automations" />
        <p className="-mt-4 text-sm text-ink-muted">
          One playbook. The app owns clips and exits. Arm here or from a
          Signal webhook. Stop adding leaves the position. Close playbook
          flattens it.
        </p>
        {error ? (
          <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="mt-4 text-sm text-success">{notice ?? "Playbook saved."}</p>
        ) : null}
        <div className="mt-6">
          <DcaPlaybookForm
            playbook={playbook}
            options={pairs}
            reduceOnly={Boolean(settings.reduceOnly)}
          />
        </div>
      </main>
    );
  }
  const settings = session ? await loadFuturesSettings(session.account.id) : null;
  const rules = session ? await loadFuturesAutomationRules(session.account.id) : [];
  const inUseRuleIds = session
    ? await listFuturesAutomationRuleIdsInUse(session.account.id)
    : [];
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
            Desk Settings
          </Link>
          .
        </p>
      ) : null}
      {session ? (
        <FuturesAutomationsDesk
          rules={rules.map(futuresRuleToForm)}
          options={pairs}
          triggerWebhooks={triggerWebhooks}
          inUseRuleIds={inUseRuleIds}
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
