import type { Metadata } from "next";
import Link from "next/link";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { StrategyDetachControl } from "@/components/strategy-detach-control";
import { ExchangeBindSelect } from "@/components/exchange-bind-select";
import { strategyDetachBlockers, deskAllowsPerpsRecipes } from "@/lib/accounts/model";
import { loadAccountUsage } from "@/lib/accounts/store";
import {
  connectionIdsBoundToOtherDesks,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import {
  listConnectionDeskBinds,
  listExchangeConnections,
} from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
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
  const saved = firstSearchValue(params.saved) === "1";
  const error = firstSearchValue(params.error);

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Desk Settings" />
      <p className="-mt-4 text-sm text-ink-muted">
        Desk-wide knobs.{" "}
        {deskAllowsPerpsRecipes(session.account.deskType)
          ? "Automations stay on their own page."
          : "The playbook will live on Automations."}{" "}
        TradingView URLs live on{" "}
        <Link href={FUTURES_PATHS.webhooks} className="text-accent">
          Webhooks
        </Link>
        . Bind the Bybit key this desk uses from this login.
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 text-sm text-success">Settings saved.</p>
      ) : null}
      <form
        action={saveFuturesSettings}
        className="mt-6 max-w-lg space-y-4 rounded-card border border-line bg-surface p-5"
      >
        {live ? (
          <ExchangeBindField
            connections={connections}
            selectedId={settings.connectionId}
            selected={selected}
            detachBlocked={detachBlocked}
            sharedConnectionIds={sharedConnectionIds}
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
        <PendingSubmitButton
          pendingLabel="Saving…"
          successKey="save-futures-settings"
          className="rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink"
        >
          Save settings
        </PendingSubmitButton>
      </form>
    </main>
  );
}

function ExchangeBindField({
  connections,
  selectedId,
  selected,
  detachBlocked,
  sharedConnectionIds,
}: {
  connections: ExchangeConnection[];
  selectedId: string | null;
  selected: ExchangeConnection | null;
  detachBlocked: boolean;
  sharedConnectionIds: string[];
}) {
  if (connections.length === 0) {
    return (
      <div>
        <p className="text-sm text-ink">Exchange</p>
        <p className="mt-1 text-sm text-ink-muted">
          Add a key on this login first.{" "}
          <Link
            href="/account/exchanges"
            className="text-accent hover:text-accent-strong"
          >
            Exchanges
          </Link>
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
    </div>
  );
}
