import type { Metadata } from "next";
import Link from "next/link";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { PageHeading } from "@/components/page-heading";
import { DeskCopyShareCard } from "@/components/desk-copy-share-form";
import { DeskSettingsForm } from "@/components/desk-settings-form";
import { StrategyDetachControl } from "@/components/strategy-detach-control";
import { ExchangeBindSelect } from "@/components/exchange-bind-select";
import { ExchangeConnectModal } from "@/components/exchange-connect-modal";
import {
  strategyDetachBlockers,
  deskAllowsOrderWebhooks,
  deskAllowsPerpsRecipes,
  deskAllowsSignalWebhooks,
  deskHref,
  deskIsCopy,
  otherDeskNames,
} from "@/lib/accounts/model";
import { evaluateCopyShare } from "@/lib/copy/model";
import { loadDeskCopyListing, loadFirstVenueFillMs } from "@/lib/copy/listings";
import { loadTraderProfile } from "@/lib/copy/profile";
import { loadCopyMinActivityDays } from "@/lib/copy/settings";
import { listTradingAccounts, loadAccountUsage } from "@/lib/accounts/store";
import {
  connectionIdsBoundToOtherDesks,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import { exchangeCredentialsConfigured } from "@/lib/exchanges/encrypt";
import {
  accountCanHoldConnections,
  connectionVenuesForDeskType,
  connectionsForDeskBind,
  getVenue,
} from "@/lib/exchanges/venues";
import {
  listConnectionDeskBinds,
  listExchangeConnections,
} from "@/lib/exchanges/store";
import {
  detachFuturesConnection,
  saveFuturesSettings,
} from "@/lib/futures/actions";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { firstSearchValue } from "@/lib/paper/open";
import { getSessionContext } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { FUTURES_PATHS } from "@/lib/strategies/registry";

export const metadata: Metadata = {
  title: "Desk Settings",
  description: "Perps desk settings.",
};

export default async function FuturesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const params = await searchParams;
  const settings = await loadFuturesSettings(session.account.id);
  const desks = await listTradingAccounts(session.member.id);
  const live = accountCanHoldConnections(session.account.mode);
  const connections = live
    ? await listExchangeConnections(session.member.id)
    : [];
  const sharedConnectionIds = live
    ? connectionIdsBoundToOtherDesks(
        await listConnectionDeskBinds(session.member.id),
        session.account.id,
      )
    : [];
  const selected =
    connections.find((row) => row.id === settings.connectionId) ?? null;
  const usage = live
    ? (await loadAccountUsage([session.account])).get(session.account.id)
    : null;
  const detachBlocked =
    Boolean(selected) &&
    strategyDetachBlockers({
      openCount: usage?.futuresOpenCount ?? 0,
      automationsRunning: false,
    }).length > 0;
  const savedFlag = firstSearchValue(params.saved);
  const saved = savedFlag === "1";
  const shareSaved = savedFlag === "share";
  const error = firstSearchValue(params.error);
  const copyDesk = deskIsCopy(session.account);
  const [trader, listing, firstFillMs, minDays] = copyDesk
    ? [null, null, null, 0] as const
    : await Promise.all([
        loadTraderProfile(session.member.id),
        loadDeskCopyListing(session.account.id),
        loadFirstVenueFillMs(session.account.id),
        loadCopyMinActivityDays(),
      ]);
  const shareEval = copyDesk
    ? { code: null, block: null }
    : evaluateCopyShare({
        mode: session.account.mode,
        deskType: session.account.deskType,
        copyOfAccountId: session.account.copyOfAccountId,
        bound: Boolean(settings.connectionId),
        alias: trader?.alias ?? null,
        firstFillMs,
        minDays,
      });
  const canSave = exchangeCredentialsConfigured();
  const settingsHref = deskHref(FUTURES_PATHS.settings, session.account.id);
  const deskVenue = getVenue(session.account.venue);
  const bindVenues = deskVenue
    ? [deskVenue]
    : connectionVenuesForDeskType(session.account.deskType);

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Desk Settings" />
      <p className="-mt-4 text-sm text-ink-muted">
        Desk-wide knobs.{" "}
        {deskAllowsPerpsRecipes(session.account) ? (
          <>
            Automations stay on their own page. Signal URLs live on{" "}
            <Link
              href={deskHref(FUTURES_PATHS.webhooks, session.account.id)}
              className="text-accent"
            >
              Webhooks
            </Link>
            . TradingView strategy alerts that place orders stay on a
            TradingView Strategy desk.
          </>
        ) : deskAllowsOrderWebhooks(session.account) ||
          deskAllowsSignalWebhooks(session.account) ? (
          <>
            {deskAllowsSignalWebhooks(session.account)
              ? "Automations stay on their own page. Signal URLs live on "
              : "TradingView URLs live on "}
            <Link
              href={deskHref(FUTURES_PATHS.webhooks, session.account.id)}
              className="text-accent"
            >
              Webhooks
            </Link>
            .
          </>
        ) : (
          session.account.copyOfAccountId
            ? "This is a copy desk. Caps, reduce-only, and Close All still apply. No ticket, bots, or webhooks."
            : "This desk is ticket only. No automations or webhooks."
        )}{" "}
        Bind a matching key from this login.
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 text-sm text-success">Settings saved.</p>
      ) : null}
      {shareSaved ? (
        <p className="mt-4 text-sm text-success">Share settings saved.</p>
      ) : null}
      <DeskSettingsForm
        action={saveFuturesSettings}
        defaultName={session.account.name}
        otherNames={otherDeskNames(desks, session.account.id)}
        successKey="save-futures-settings"
        className="mt-6 max-w-lg space-y-4 rounded-card border border-line bg-surface p-5"
      >
        {live ? (
          <ExchangeBindField
            connections={connectionsForDeskBind(
              connections,
              session.account,
              settings.connectionId,
            )}
            selectedId={settings.connectionId}
            selected={selected}
            detachBlocked={detachBlocked}
            sharedConnectionIds={sharedConnectionIds}
            canSave={canSave}
            venues={bindVenues}
            next={settingsHref}
          />
        ) : (
          <p className="text-sm text-ink-muted">
            This is a Paper Trading book. Orders stay on the in-app ledger.
          </p>
        )}
        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="reduceOnly"
            defaultChecked={settings.reduceOnly}
            className="mt-0.5"
          />
          <span>
            Reduce only
            <span className="mt-1 block text-xs text-ink-muted">
              Blocks Buy and Sell. Close still works.
            </span>
          </span>
        </label>
        <div className="space-y-3 border-t border-line pt-4">
          <p className="text-sm text-ink">Risk caps</p>
          <p className="text-xs text-ink-muted">
            Empty means no cap. Buy and Sell reject if they would breach. Close
            is never blocked.
          </p>
          <label className="block text-sm text-ink">
            Max value per symbol
            <span className="relative mt-1 block">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
                $
              </span>
              <GroupedNumberInput
                name="maxValuePerSymbol"
                defaultValue={
                  settings.maxValuePerSymbol === null
                    ? ""
                    : String(settings.maxValuePerSymbol)
                }
                allowDecimal
                placeholder="No cap"
                ariaLabel="Max value per symbol"
                className="w-full rounded-control border border-line bg-surface-raised py-2 pr-3 pl-7 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
              />
            </span>
          </label>
          <label className="block text-sm text-ink">
            Max open positions
            <GroupedNumberInput
              name="maxOpenPositions"
              defaultValue={
                settings.maxOpenPositions === null
                  ? ""
                  : String(settings.maxOpenPositions)
              }
              placeholder="No cap"
              className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
            />
          </label>
        </div>
      </DeskSettingsForm>
      {copyDesk ? null : (
        <DeskCopyShareCard
          account={session.account}
          listing={listing}
          block={shareEval.block}
          needsAlias={shareEval.code === "no_alias"}
        />
      )}
    </main>
  );
}

function ExchangeBindField({
  connections,
  selectedId,
  selected,
  detachBlocked,
  sharedConnectionIds,
  canSave,
  venues,
  next,
}: {
  connections: ExchangeConnection[];
  selectedId: string | null;
  selected: ExchangeConnection | null;
  detachBlocked: boolean;
  sharedConnectionIds: string[];
  canSave: boolean;
  venues: ReturnType<typeof connectionVenuesForDeskType>;
  next: string;
}) {
  const addConnection = canSave ? (
    <div className="mt-2">
      <ExchangeConnectModal venues={venues} next={next} />
    </div>
  ) : null;

  if (connections.length === 0) {
    return (
      <div>
        <p className="text-sm text-ink">Exchange</p>
        <p className="mt-1 text-sm text-ink-muted">
          No matching key on this login yet.
        </p>
        {addConnection}
        <p className="mt-2 text-sm text-ink-muted">
          Keys also live on{" "}
          <Link
            href="/account/exchanges"
            className="text-accent hover:text-accent-strong"
          >
            Exchanges
          </Link>
          .
        </p>
      </div>
    );
  }

  const options = connections.filter(
    (row) => row.status === "active" || row.id === selectedId,
  );

  return (
    <div>
      <p className="text-sm text-ink">Exchange</p>
      <ExchangeBindSelect
        options={options}
        selectedId={selectedId}
        allowNone={!selected}
        sharedConnectionIds={sharedConnectionIds}
      />
      {selected ? (
        <div className="mt-2">
          <StrategyDetachControl
            blocked={detachBlocked}
            detachAction={detachFuturesConnection}
          />
        </div>
      ) : null}
      {addConnection}
    </div>
  );
}
