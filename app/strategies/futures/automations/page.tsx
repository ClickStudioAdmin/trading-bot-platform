import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { toBacktestLibraryItem } from "@/lib/backtest/library";
import { DcaPlaybooksDesk } from "@/components/dca-playbook-form";
import { FuturesAutomationsDesk } from "@/components/futures-rules-form";
import { FuturesRulesGuide } from "@/components/futures-rules-guide";
import { dcaPaperBookUsdt } from "@/lib/dca/book";
import { listDcaPlaybooksForAccount } from "@/lib/dca/store";
import { loadFuturesPositions } from "@/lib/futures/list";
import { getSessionContext } from "@/lib/auth/session";
import { loadAccountSnapshot } from "@/lib/exchanges/account-snapshot";
import { fetchBybitTickers } from "@/lib/exchanges/bybit/client";
import { loadUsdtLinearPerps } from "@/lib/exchanges/bybit/perp";
import { HYPERLIQUID_DCA_UI } from "@/lib/dca/ui-policy";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";
import {
  loadHyperliquidLinearPerps,
  loadHyperliquidTickerMap,
} from "@/lib/venues/hyperliquid/market";
import { listExchangeConnections } from "@/lib/exchanges/store";
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
import { withMarketCapRank } from "@/lib/pairs/page";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { deskAllowsDcaPlaybooks, deskAllowsPerpsRecipes, deskHref, deskHomePath } from "@/lib/accounts/model";
import { memberIsAdmin } from "@/lib/admin/access";
import { redirect } from "next/navigation";
import {
  listApplyableSets,
  listApplyableTemplates,
  templateToSummary,
} from "@/lib/templates/store";

export const metadata: Metadata = {
  title: "Automations (bots)",
  description: "Bots for USDT linear perpetuals.",
};

export default async function FuturesAutomationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  if (session?.account.deskType === "signal_follower") {
    redirect(deskHref(FUTURES_PATHS.webhooks, session.account.id));
  }
  if (
    session &&
    !deskAllowsDcaPlaybooks(session.account) &&
    !deskAllowsPerpsRecipes(session.account)
  ) {
    redirect(deskHomePath(session.account.deskType, session.account.id));
  }
  if (session && deskAllowsDcaPlaybooks(session.account)) {
    const playbooks = await listDcaPlaybooksForAccount(session.account.id);
    const settings = await loadFuturesSettings(session.account.id);
    const hl = session.account.venue === "hyperliquid";
    const env = hyperliquidInfoEnvironment(session.account.venueEnvironment);
    const [pairs, tickers] = await Promise.all([
      hl
        ? loadHyperliquidLinearPerps(env).catch(() => []).then(withMarketCapRank)
        : loadUsdtLinearPerps().catch(() => []).then(withMarketCapRank),
      hl
        ? loadHyperliquidTickerMap(env).catch(() => null)
        : fetchBybitTickers("linear").catch(() => null),
    ]);
    const lastPrices: Record<string, number> = {};
    if (tickers) {
      for (const [symbol, row] of tickers) {
        const last = Number(row.lastPrice);
        if (last > 0) {
          lastPrices[symbol] = last;
        }
      }
    }
    const signalWebhooks = (
      await listFuturesWebhooks({
        accountId: session.account.id,
        origin: futuresWebhookOrigin(await headers()),
      })
    )
      .filter((row) => row.kind === "signal")
      .map((row) => ({ id: row.id, name: row.name }));
    let availableUsdt: number | null = null;
    let bookUsdt: number | null = null;
    let leverage: number | null = accountCanHoldConnections(
      session.account.mode,
    )
      ? null
      : (settings.paperLeverage ?? null);
    const openPositions = await loadFuturesPositions({ status: "open" });
    if (accountCanHoldConnections(session.account.mode) && settings.connectionId) {
      const connections = await listExchangeConnections(session.member.id);
      const bound = connections.find((row) => row.id === settings.connectionId);
      if (bound) {
        const snapshot = await loadAccountSnapshot(session.member.id, bound.id);
        if (snapshot.ok) {
          availableUsdt = snapshot.snapshot.availableBalance;
          bookUsdt = availableUsdt;
          leverage = snapshot.snapshot.leverage;
        }
      }
    } else if (!accountCanHoldConnections(session.account.mode)) {
      const positions = await loadFuturesPositions();
      const realized = positions.reduce(
        (sum, row) => sum + row.realizedUsdt,
        0,
      );
      bookUsdt = dcaPaperBookUsdt(realized);
    }
    const saved = firstSearchValue(params.saved) === "1";
    const error = firstSearchValue(params.error);
    const notice = firstSearchValue(params.notice);
    const templates = await listApplyableTemplates({
      userId: session.member.id,
      deskType: "dca",
    });
    const sets = await listApplyableSets({
      userId: session.member.id,
      deskType: "dca",
    });
    return (
      <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
        <PageHeading as="h2" title="Automations (bots)" />
        <p className="-mt-4 text-sm text-ink-muted">
          Add a bot per contract. The app owns orders and exits. Save
          and Arm to listen, then price, indicator, or a bound Signal.
          Manual uses Save and Trigger Long or Short. Stop adding leaves the
          position. Close bot flattens it.
        </p>
        {hl ? (
          <p className="mt-4 rounded-card border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
            This Hyperliquid desk is one-way. Long or short only. Indicators
            use Hyperliquid candles. Size is coin or USDC.
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="mt-4 text-sm text-success">{notice ?? "Bot saved."}</p>
        ) : null}
        <div className="mt-6">
          <DcaPlaybooksDesk
            playbooks={playbooks}
            options={pairs}
            signalWebhooks={signalWebhooks}
            availableUsdt={availableUsdt}
            bookUsdt={bookUsdt}
            leverage={leverage}
            lastPrices={lastPrices}
            reduceOnly={Boolean(settings.reduceOnly)}
            webhooksHref={deskHref(FUTURES_PATHS.webhooks, session.account.id)}
            isAdmin={memberIsAdmin(session.member)}
            accountId={session.account.id}
            templates={templates.map(templateToSummary)}
            sets={sets}
            policy={hl ? HYPERLIQUID_DCA_UI : undefined}
            venueEnvironment={session.account.venueEnvironment}
            backtestLibrary={templates
              .map(toBacktestLibraryItem)
              .filter((row): row is NonNullable<typeof row> => Boolean(row))}
            openPositions={openPositions.map((row) => ({
              symbol: row.symbol,
              side: row.side,
              qty: row.qty,
            }))}
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
  const hl = session?.account.venue === "hyperliquid";
  const env = hyperliquidInfoEnvironment(session?.account.venueEnvironment);
  const pairs = hl
    ? await loadHyperliquidLinearPerps(env).catch(() => []).then(withMarketCapRank)
    : await loadUsdtLinearPerps().catch(() => []).then(withMarketCapRank);
  const exchangeBook = Boolean(
    session && accountCanHoldConnections(session.account.mode),
  );
  const saved = firstSearchValue(params.saved) === "1";
  const error = firstSearchValue(params.error);
  const templates = session
    ? await listApplyableTemplates({
        userId: session.member.id,
        deskType: "perps",
      })
    : [];
  const sets = session
    ? await listApplyableSets({
        userId: session.member.id,
        deskType: "perps",
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
      {settings?.reduceOnly ? (
        <p className="mt-4 mb-4 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Reduce only is on. Buy and Sell stay blocked until you turn it off in{" "}
          <Link href={deskHref(FUTURES_PATHS.settings, session?.account.id)} className="underline">
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
          isAdmin={memberIsAdmin(session.member)}
          accountId={session.account.id}
          templates={templates.map(templateToSummary)}
          sets={sets}
          venueId={hl ? "hyperliquid" : "bybit"}
          quoteLabel={hl ? "USDC" : "USDT"}
          venueEnvironment={session.account.venueEnvironment}
          backtestLibrary={templates
            .map(toBacktestLibraryItem)
            .filter((row): row is NonNullable<typeof row> => Boolean(row))}
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
