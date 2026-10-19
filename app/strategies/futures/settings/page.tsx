import type { Metadata } from "next";
import Link from "next/link";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { PageHeading } from "@/components/page-heading";
import { CopyDeskGuardsFields } from "@/components/copy-desk-guards-fields";
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
import { formatCopyPaperStartingUsdt } from "@/lib/copy/decide";
import { loadDeskCopySettings } from "@/lib/copy/follower-settings";
import { evaluateCopyShare } from "@/lib/copy/model";
import { loadDeskCopyListing, loadFirstVenueFillMs } from "@/lib/copy/listings";
import { loadTraderProfile } from "@/lib/copy/profile";
import { loadCopyPlatformSettings } from "@/lib/copy/settings";
import { listTradingAccounts, loadAccountUsage } from "@/lib/accounts/store";
import {
  connectionIdsBoundToOtherDesks,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import { exchangeCredentialsConfigured } from "@/lib/exchanges/encrypt";
import {
  accountCanHoldConnections,
  connectionsForDeskBind,
  getVenue,
} from "@/lib/exchanges/venues";
import {
  deskBindVenues,
  environmentAllowedForDesk,
  offeredConnectionVenues,
} from "@/lib/exchanges/availability";
import { loadExchangeAccessForUser } from "@/lib/exchanges/availability-store";
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
import { memberIsAdmin } from "@/lib/admin/access";
import { getSessionContext } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { FUTURES_PATHS } from "@/lib/strategies/registry";

export const metadata: Metadata = {
  title: "Desk Settings",
  description: "Futures desk settings.",
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
  const allowSharedKeys = memberIsAdmin(session.member);
  const sharedConnectionIds = live
    ? connectionIdsBoundToOtherDesks(
        await listConnectionDeskBinds(session.member.id),
        session.account.id,
      )
    : [];
  const selected =
    connections.find((row) => row.id === settings.connectionId) ?? null;
  const usage =
    live || deskIsCopy(session.account)
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
  const copySaved = savedFlag === "copy";
  const error = firstSearchValue(params.error);
  const copyDesk = deskIsCopy(session.account);
  const followerSettings = copyDesk
    ? await loadDeskCopySettings(session.account.id)
    : null;
  const [trader, listing, firstFillMs, copySettings] = copyDesk
    ? [null, null, null, { minActivityDays: 0, maxFollowersDefault: null, maxFollowersCeiling: null }] as const
    : await Promise.all([
        loadTraderProfile(session.member.id),
        loadDeskCopyListing(session.account.id),
        loadFirstVenueFillMs(session.account.id),
        loadCopyPlatformSettings(),
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
        minDays: copySettings.minActivityDays,
      });
  const canSave = exchangeCredentialsConfigured();
  const settingsHref = deskHref(FUTURES_PATHS.settings, session.account.id);
  const exchangeAccess = await loadExchangeAccessForUser(session.member.id);
  const deskVenue = getVenue(session.account.venue);
  const bindVenues = deskVenue
    ? deskBindVenues(
        exchangeAccess,
        session.account.deskType,
        deskVenue.id,
        session.account.venueEnvironment,
      )
    : offeredConnectionVenues(exchangeAccess, session.account.deskType);
  const bindConnections = connections.filter(
    (row) =>
      row.id === settings.connectionId ||
      (session.account.venueEnvironment != null &&
        row.venue === session.account.venue &&
        row.environment === session.account.venueEnvironment) ||
      environmentAllowedForDesk(
        exchangeAccess,
        session.account.deskType,
        row.venue,
        row.environment,
      ),
  );

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
            ? "This is a copy desk. Bind, sizing, max daily loss, and Close All live in one place. Pause or unfollow in the header. No ticket, bots, or webhooks."
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
        <p className="mt-4 rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">Settings saved.</p>
      ) : null}
      {copySaved ? (
        <p className="mt-4 rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">Copy guards saved.</p>
      ) : null}
      {shareSaved ? (
        <p className="mt-4 rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">Share settings saved.</p>
      ) : null}
      <div
        className={
          copyDesk
            ? "mt-6"
            : "mt-6 grid items-start gap-6 lg:grid-cols-2"
        }
      >
        <div className="space-y-4 rounded-card border border-line bg-surface p-5">
        <DeskSettingsForm
          action={saveFuturesSettings}
          defaultName={session.account.name}
          otherNames={otherDeskNames(desks, session.account.id)}
          successKey="save-futures-settings"
          className="space-y-4"
          split={Boolean(copyDesk && followerSettings)}
          leading={
            copyDesk && followerSettings ? (
              live ? (
                <ExchangeBindField
                  connections={connectionsForDeskBind(
                    bindConnections,
                    session.account,
                    settings.connectionId,
                  )}
                  selectedId={settings.connectionId}
                  selected={selected}
                  detachBlocked={detachBlocked}
                  sharedConnectionIds={sharedConnectionIds}
                  allowSharedKeys={allowSharedKeys}
                  canSave={canSave}
                  venues={bindVenues}
                  next={settingsHref}
                />
              ) : (
                <div className="space-y-4">
                <p className="text-sm text-ink-muted">
                  This is a Paper Trading book. Orders stay on the in-app
                  ledger. Paper starts at {formatCopyPaperStartingUsdt()}.
                  Account balance is that plus realized and unrealized.
                </p>
                <PaperLeverageField defaultValue={settings.paperLeverage} />
                </div>
              )
            ) : undefined
          }
        >
          {copyDesk && followerSettings ? (
            <CopyDeskGuardsFields
              defaultSizeMode={followerSettings.sizeMode}
              defaultPercent={
                followerSettings.sizePercent == null
                  ? ""
                  : String(followerSettings.sizePercent)
              }
              defaultBookUsdt={
                followerSettings.sizeBookUsdt == null
                  ? ""
                  : String(followerSettings.sizeBookUsdt)
              }
              defaultMaxDailyLossUsdt={
                followerSettings.maxDailyLossUsdt == null
                  ? ""
                  : String(followerSettings.maxDailyLossUsdt)
              }
              defaultMaxDrawdownPct={
                followerSettings.maxDrawdownPct == null
                  ? ""
                  : String(followerSettings.maxDrawdownPct)
              }
              defaultMaxAdverseMovePct={
                followerSettings.maxAdverseMovePct == null
                  ? ""
                  : String(followerSettings.maxAdverseMovePct)
              }
              paper={!live}
            />
          ) : (
            <>
              {live ? (
                <ExchangeBindField
                  connections={connectionsForDeskBind(
                    bindConnections,
                    session.account,
                    settings.connectionId,
                  )}
                  selectedId={settings.connectionId}
                  selected={selected}
                  detachBlocked={detachBlocked}
                  sharedConnectionIds={sharedConnectionIds}
                  allowSharedKeys={allowSharedKeys}
                  canSave={canSave}
                  venues={bindVenues}
                  next={settingsHref}
                />
              ) : (
                <p className="text-sm text-ink-muted">
                  This is a Paper Trading book. Orders stay on the in-app
                  ledger.
                </p>
              )}
              {live ? null : (
                <PaperLeverageField
                  defaultValue={settings.paperLeverage}
                />
              )}
            </>
          )}
        </DeskSettingsForm>
        </div>
        {copyDesk ? null : (
          <DeskCopyShareCard
            account={session.account}
            listing={listing}
            block={shareEval.block}
            needsAlias={shareEval.code === "no_alias"}
            maxFollowersDefault={copySettings.maxFollowersDefault}
            maxFollowersCeiling={copySettings.maxFollowersCeiling}
            openTradeCount={
              (usage?.futuresOpenCount ?? 0) + (usage?.workingCount ?? 0)
            }
          />
        )}
      </div>
    </main>
  );
}

function PaperLeverageField({
  defaultValue,
}: {
  defaultValue: number | null;
}) {
  return (
    <label className="block text-sm text-ink">
      Paper leverage
      <span className="mt-1 block text-hint text-ink-muted">
        Used for ROE on Performance (P&L ÷ (notional ÷ this)). Empty
        leaves ROE as —. Does not change size or place venue orders.
        Applies to new trades and as a fallback for older paper closes
        on this desk.
      </span>
      <GroupedNumberInput
        name="paperLeverage"
        defaultValue={defaultValue === null ? "" : String(defaultValue)}
        allowDecimal
        placeholder="—"
        ariaLabel="Paper leverage"
        className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
      />
    </label>
  );
}

function ExchangeBindField({
  connections,
  selectedId,
  selected,
  detachBlocked,
  sharedConnectionIds,
  allowSharedKeys,
  canSave,
  venues,
  next,
}: {
  connections: ExchangeConnection[];
  selectedId: string | null;
  selected: ExchangeConnection | null;
  detachBlocked: boolean;
  sharedConnectionIds: string[];
  allowSharedKeys: boolean;
  canSave: boolean;
  venues: ReturnType<typeof deskBindVenues>;
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
            href="/account/sub-accounts?tab=exchanges"
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
        allowSharedKeys={allowSharedKeys}
        trailing={
          selected ? (
            <StrategyDetachControl
              blocked={detachBlocked}
              detachAction={detachFuturesConnection}
            />
          ) : null
        }
      />
      {addConnection}
    </div>
  );
}
