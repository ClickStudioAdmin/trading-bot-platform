import type { Metadata } from "next";
import Link from "next/link";
import { AutomationsPageFrame } from "@/components/automations-page-frame";
import {
  toBacktestLibraryItem,
  toSavedBacktestMatch,
} from "@/lib/backtest/library";
import { listBacktestRuns } from "@/lib/backtest/store";
import { DcaPlaybooksDesk } from "@/components/dca-playbook-form";
import { FuturesAutomationsDesk } from "@/components/futures-rules-form";
import {
  AUTOMATIONS_NEW,
  automationsEditTitle,
  parseAutomationsClone,
  parseAutomationsEdit,
} from "@/lib/bots/automations-path";
import { futuresAutomationsBotBlotter } from "@/lib/bots/automations-list";
import { dcaHintKey, dcaHintsForOpen, type DcaPlaybook } from "@/lib/dca/playbook";
import { futuresPositionIsLive } from "@/lib/futures/pending-close";
import { dcaPaperBookUsdt } from "@/lib/dca/book";
import {
  listDcaPlaybooksForAccount,
  loadDcaPlaybookById,
} from "@/lib/dca/store";
import { loadFuturesPositions } from "@/lib/futures/list";
import { getSessionContext } from "@/lib/auth/session";
import { loadAccountSnapshot } from "@/lib/exchanges/account-snapshot";
import { fetchBybitTickers } from "@/lib/exchanges/bybit/client";
import { listAgreementSymbols } from "@/lib/exchanges/agreement-store";
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
    redirect(deskHomePath(session.account, session.account.id));
  }
  const saved = firstSearchValue(params.saved) === "1";
  const createdId = firstSearchValue(params.created);
  const error = firstSearchValue(params.error);
  const notice = firstSearchValue(params.notice);
  const requestedEdit = parseAutomationsEdit(firstSearchValue(params.edit));
  const clone = parseAutomationsClone(firstSearchValue(params.clone));
  const openingForm = Boolean(requestedEdit || clone);

  if (!session) {
    return (
      <AutomationsPageFrame
        listHref={deskHref(FUTURES_PATHS.automations, null)}
        editTitle={null}
      >
        <p className="mt-6 text-sm text-ink-muted">
          <Link href="/sign-in" className="text-accent">
            Sign in
          </Link>{" "}
          to save automations.
        </p>
      </AutomationsPageFrame>
    );
  }

  if (deskAllowsDcaPlaybooks(session.account)) {
    const hl = session.account.venue === "hyperliquid";
    const env = hyperliquidInfoEnvironment(session.account.venueEnvironment);
    const listHref = deskHref(FUTURES_PATHS.automations, session.account.id);
    const exchangeBook = accountCanHoldConnections(session.account.mode);
    const editId =
      requestedEdit && requestedEdit !== AUTOMATIONS_NEW ? requestedEdit : null;
    const formLoad = openingForm
      ? await loadDcaAutomationsForm({
          accountId: session.account.id,
          userId: session.member.id,
          hl,
          env,
          exchangeBook,
          editId,
          cloneId: clone,
        })
      : null;
    const editMissing = Boolean(
      formLoad &&
        editId &&
        !formLoad.playbooks.some((playbook) => playbook.id === editId),
    );
    const loaded =
      formLoad && !editMissing
        ? formLoad
        : await loadDcaAutomationsList({
            accountId: session.account.id,
            userId: session.member.id,
          });
    const {
      playbooks: loadedPlaybooks,
      settings,
      openPositions,
      closedPositions,
      templates,
      sets,
    } = loaded;
    const form = formLoad && !editMissing ? formLoad.form : null;
    const agreementSymbols = hl
      ? []
      : await listAgreementSymbols(settings.connectionId);
    const leverage =
      form?.leverage ??
      (exchangeBook ? null : (settings.paperLeverage ?? null));
    const availableUsdt = form?.availableUsdt ?? null;
    const bookUsdt = form?.bookUsdt ?? null;
    const signalWebhooks = form?.signalWebhooks ?? [];
    const pairs = form?.pairs ?? [];
    const lastPrices = form?.lastPrices ?? {};
    const backtestLibrary = (form?.backtestLibrary ?? []).filter(
      (row): row is NonNullable<typeof row> => Boolean(row),
    );
    const savedBacktests = form?.savedBacktests ?? [];
    const liveOpen = openPositions.filter((row) =>
      futuresPositionIsLive(row.status),
    );
    const dcaHints = dcaHintsForOpen(loadedPlaybooks, liveOpen);
    const blotter = Object.fromEntries(
      loadedPlaybooks.map((playbook) => [
        playbook.id,
        futuresAutomationsBotBlotter(
          playbook.id,
          liveOpen,
          closedPositions,
          loadedPlaybooks,
          (row) =>
            row.side === "long" || row.side === "short"
              ? dcaHints[dcaHintKey(row.symbol, row.side)]?.playbookId
              : null,
          leverage,
        ),
      ]),
    );
    const knownEdit =
      requestedEdit &&
      requestedEdit !== AUTOMATIONS_NEW &&
      !loadedPlaybooks.some((playbook) => playbook.id === requestedEdit)
        ? null
        : requestedEdit;
    const editTitle = automationsEditTitle({
      edit: knownEdit,
      name: loadedPlaybooks.find((playbook) => playbook.id === knownEdit)?.name,
    });
    return (
      <AutomationsPageFrame listHref={listHref} editTitle={editTitle}>
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
            playbooks={loadedPlaybooks}
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
            backtestLibrary={backtestLibrary.filter(
              (row): row is NonNullable<typeof row> => Boolean(row),
            )}
            savedBacktests={savedBacktests}
            openPositions={liveOpen.map((row) => ({
              symbol: row.symbol,
              side: row.side,
              qty: row.qty,
            }))}
            agreementSymbols={agreementSymbols}
            edit={knownEdit}
            clone={clone}
            listHref={listHref}
            blotter={blotter}
            revealId={createdId}
          />
        </div>
      </AutomationsPageFrame>
    );
  }

  const hl = session.account.venue === "hyperliquid";
  const env = hyperliquidInfoEnvironment(session.account.venueEnvironment);
  const listHref = deskHref(FUTURES_PATHS.automations, session.account.id);
  const exchangeBook = accountCanHoldConnections(session.account.mode);
  const origin = openingForm
    ? futuresWebhookOrigin(await headers())
    : null;
  const [settings, rules, inUseRuleIds, perpsOpen, perpsClosed, templates, sets, pairs, triggerWebhooks, backtestRuns] =
    await Promise.all([
      loadFuturesSettings(session.account.id),
      loadFuturesAutomationRules(session.account.id),
      listFuturesAutomationRuleIdsInUse(session.account.id),
      loadFuturesPositions({ status: "open" }).catch(() => []),
      loadFuturesPositions({ status: "closed" }).catch(() => []),
      listApplyableTemplates({
        userId: session.member.id,
        deskType: "perps",
      }).catch(() => []),
      listApplyableSets({
        userId: session.member.id,
        deskType: "perps",
      }).catch(() => []),
      openingForm
        ? hl
          ? loadHyperliquidLinearPerps(env).catch(() => []).then(withMarketCapRank)
          : loadUsdtLinearPerps().catch(() => []).then(withMarketCapRank)
        : Promise.resolve([]),
      openingForm && origin
        ? listFuturesWebhooks({
            accountId: session.account.id,
            origin,
          }).then((rows) => rows.filter((row) => row.kind === "signal"))
        : Promise.resolve([]),
      openingForm
        ? listBacktestRuns({
            userId: session.member.id,
            standaloneOnly: true,
            primaryOnly: true,
          })
        : Promise.resolve([]),
    ]);
  const agreementSymbols = hl
    ? []
    : await listAgreementSymbols(settings.connectionId);
  const knownEdit =
    requestedEdit &&
    requestedEdit !== AUTOMATIONS_NEW &&
    !rules.some((rule) => rule.id === requestedEdit)
      ? null
      : requestedEdit;
  const editTitle = automationsEditTitle({
    edit: knownEdit,
    name: rules.find((rule) => rule.id === knownEdit)?.name,
  });
  const perpsBlotter = Object.fromEntries(
    rules.flatMap((rule) => {
      if (!rule.id) {
        return [];
      }
      return [
        [
          rule.id,
          futuresAutomationsBotBlotter(
            rule.id,
            perpsOpen,
            perpsClosed,
            [],
            undefined,
            exchangeBook ? null : (settings.paperLeverage ?? null),
          ),
        ] as const,
      ];
    }),
  );

  return (
    <AutomationsPageFrame listHref={listHref} editTitle={editTitle}>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 text-sm text-success">Bots saved.</p>
      ) : null}
      {settings.reduceOnly ? (
        <p className="mt-4 mb-4 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Reduce only is on. Buy and Sell stay blocked until you turn it off in{" "}
          <Link href={deskHref(FUTURES_PATHS.settings, session.account.id)} className="underline">
            Desk Settings
          </Link>
          .
        </p>
      ) : null}
      <div className="mt-6">
        <FuturesAutomationsDesk
          rules={rules.map(futuresRuleToForm)}
          options={pairs}
          triggerWebhooks={triggerWebhooks}
          inUseRuleIds={inUseRuleIds}
          reduceOnly={Boolean(settings.reduceOnly)}
          isAdmin={memberIsAdmin(session.member)}
          accountId={session.account.id}
          templates={templates.map(templateToSummary)}
          sets={sets}
          venueId={hl ? "hyperliquid" : "bybit"}
          agreementSymbols={agreementSymbols}
          quoteLabel={hl ? "USDC" : "USDT"}
          venueEnvironment={session.account.venueEnvironment}
          backtestLibrary={backtestRuns
            .map(toBacktestLibraryItem)
            .filter((row): row is NonNullable<typeof row> => Boolean(row))}
          savedBacktests={backtestRuns.flatMap((run) => {
            const match = toSavedBacktestMatch(run);
            return match ? [match] : [];
          })}
          edit={knownEdit}
          clone={clone}
          listHref={listHref}
          blotter={perpsBlotter}
          revealId={createdId}
        />
      </div>
    </AutomationsPageFrame>
  );
}

type DcaListLoad = {
  playbooks: DcaPlaybook[];
  settings: Awaited<ReturnType<typeof loadFuturesSettings>>;
  openPositions: Awaited<ReturnType<typeof loadFuturesPositions>>;
  closedPositions: Awaited<ReturnType<typeof loadFuturesPositions>>;
  templates: Awaited<ReturnType<typeof listApplyableTemplates>>;
  sets: Awaited<ReturnType<typeof listApplyableSets>>;
};

async function loadDcaAutomationsList(input: {
  accountId: string;
  userId: string;
}): Promise<DcaListLoad> {
  const [playbooks, settings, openPositions, closedPositions, templates, sets] =
    await Promise.all([
      listDcaPlaybooksForAccount(input.accountId),
      loadFuturesSettings(input.accountId),
      loadFuturesPositions({ status: "open" }).catch(() => []),
      loadFuturesPositions({ status: "closed" }).catch(() => []),
      listApplyableTemplates({
        userId: input.userId,
        deskType: "dca",
      }).catch(() => []),
      listApplyableSets({
        userId: input.userId,
        deskType: "dca",
      }).catch(() => []),
    ]);
  return {
    playbooks,
    settings,
    openPositions,
    closedPositions,
    templates,
    sets,
  };
}

type DcaFormLoad = DcaListLoad & {
  form: {
    availableUsdt: number | null;
    bookUsdt: number | null;
    leverage: number | null;
    signalWebhooks: { id: string; name: string }[];
    pairs: Awaited<ReturnType<typeof loadUsdtLinearPerps>>;
    lastPrices: Record<string, number>;
    backtestLibrary: ReturnType<typeof toBacktestLibraryItem>[];
    savedBacktests: NonNullable<ReturnType<typeof toSavedBacktestMatch>>[];
  };
};

async function loadDcaAutomationsForm(input: {
  accountId: string;
  userId: string;
  hl: boolean;
  env: ReturnType<typeof hyperliquidInfoEnvironment>;
  exchangeBook: boolean;
  editId: string | null;
  cloneId: string | null;
}): Promise<DcaFormLoad> {
  const origin = futuresWebhookOrigin(await headers());
  const [
    settings,
    pairs,
    tickers,
    webhookRows,
    templates,
    sets,
    backtestRuns,
    edited,
    cloned,
    positions,
    connections,
  ] = await Promise.all([
    loadFuturesSettings(input.accountId),
    input.hl
      ? loadHyperliquidLinearPerps(input.env).catch(() => []).then(withMarketCapRank)
      : loadUsdtLinearPerps().catch(() => []).then(withMarketCapRank),
    input.hl
      ? loadHyperliquidTickerMap(input.env).catch(() => null)
      : fetchBybitTickers("linear").catch(() => null),
    listFuturesWebhooks({
      accountId: input.accountId,
      origin,
    }).catch(() => []),
    listApplyableTemplates({
      userId: input.userId,
      deskType: "dca",
    }).catch(() => []),
    listApplyableSets({
      userId: input.userId,
      deskType: "dca",
    }).catch(() => []),
    listBacktestRuns({
      userId: input.userId,
      standaloneOnly: true,
      primaryOnly: true,
    }),
    input.editId
      ? loadDcaPlaybookById(input.editId, input.accountId)
      : Promise.resolve(null),
    input.cloneId && input.cloneId !== input.editId
      ? loadDcaPlaybookById(input.cloneId, input.accountId)
      : Promise.resolve(null),
    loadFuturesPositions().catch(() => []),
    input.exchangeBook
      ? listExchangeConnections(input.userId)
      : Promise.resolve([]),
  ]);
  const playbooks = [edited, cloned].filter(
    (row): row is DcaPlaybook => Boolean(row),
  );
  const openPositions = positions.filter((row) =>
    futuresPositionIsLive(row.status),
  );
  const closedPositions = positions.filter((row) => row.status === "closed");
  let availableUsdt: number | null = null;
  let bookUsdt: number | null = null;
  let leverage: number | null = input.exchangeBook
    ? null
    : (settings.paperLeverage ?? null);
  if (input.exchangeBook && settings.connectionId) {
    const bound = connections.find((row) => row.id === settings.connectionId);
    if (bound) {
      const snapshot = await loadAccountSnapshot(input.userId, bound.id).catch(
        () => ({ ok: false as const, error: "snapshot" }),
      );
      if (snapshot.ok) {
        availableUsdt = snapshot.snapshot.availableBalance;
        bookUsdt = availableUsdt;
        leverage = snapshot.snapshot.leverage;
      }
    }
  } else if (!input.exchangeBook) {
    const realized = positions.reduce((sum, row) => sum + row.realizedUsdt, 0);
    bookUsdt = dcaPaperBookUsdt(realized);
  }
  const lastPrices: Record<string, number> = {};
  if (tickers) {
    for (const [symbol, row] of tickers) {
      const last = Number(row.lastPrice);
      if (last > 0) {
        lastPrices[symbol] = last;
      }
    }
  }
  return {
    playbooks,
    settings,
    openPositions,
    closedPositions,
    templates,
    sets,
    form: {
      availableUsdt,
      bookUsdt,
      leverage,
      signalWebhooks: webhookRows
        .filter((row) => row.kind === "signal")
        .map((row) => ({ id: row.id, name: row.name })),
      pairs,
      lastPrices,
      backtestLibrary: backtestRuns.map(toBacktestLibraryItem),
      savedBacktests: backtestRuns.flatMap((run) => {
        const match = toSavedBacktestMatch(run);
        return match ? [match] : [];
      }),
    },
  };
}
