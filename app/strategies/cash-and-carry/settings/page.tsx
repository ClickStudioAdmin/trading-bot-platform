import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { DeskSettingsForm } from "@/components/desk-settings-form";
import { StrategyDetachControl } from "@/components/strategy-detach-control";
import { ExchangeBindSelect } from "@/components/exchange-bind-select";
import { ExchangeConnectModal } from "@/components/exchange-connect-modal";
import { savePaperSettings } from "@/lib/engine/actions";
import { loadEngineSettings } from "@/lib/engine/settings";
import { deskHref, otherDeskNames, strategyDetachBlockers } from "@/lib/accounts/model";
import { exchangeCredentialsConfigured } from "@/lib/exchanges/encrypt";
import { listTradingAccounts, loadAccountUsage } from "@/lib/accounts/store";
import {
  connectionIdsBoundToOtherDesks,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import {
  listConnectionDeskBinds,
  listExchangeConnections,
} from "@/lib/exchanges/store";
import {
  accountCanHoldConnections,
  connectionVenuesForDeskType,
  connectionsForDeskBind,
} from "@/lib/exchanges/venues";
import { usableBookShareToInput } from "@/lib/opportunities/capacity";
import { firstSearchValue } from "@/lib/paper/open";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { getSessionContext } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Desk Settings",
  description: "Cash and Carry desk settings.",
};

export default async function CashAndCarrySettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const params = await searchParams;
  const settings = await loadEngineSettings();
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
  const selected = connections.find((row) => row.id === settings.connectionId) ?? null;
  const usage = live
    ? (await loadAccountUsage([session.account])).get(session.account.id)
    : null;
  const detachBlocked =
    Boolean(selected) &&
    strategyDetachBlockers({
      openCount: usage?.carryOpenCount ?? 0,
      automationsRunning: Boolean(usage?.automationsRunning),
    }).length > 0;
  const saved = firstSearchValue(params.saved) === "1";
  const error = firstSearchValue(params.error);
  const canSave = exchangeCredentialsConfigured();
  const settingsHref = deskHref(
    "/strategies/cash-and-carry/settings",
    session.account.id,
  );

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Desk Settings" />
      <p className="-mt-4 text-sm text-ink-muted">
        Desk-wide knobs. Automations stay on their own page.
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 text-sm text-success">Settings saved.</p>
      ) : null}
      <DeskSettingsForm
        action={savePaperSettings}
        defaultName={session.account.name}
        otherNames={otherDeskNames(desks, session.account.id)}
        successKey="save-settings"
        className="mt-6 max-w-md space-y-4 rounded-card border border-line bg-surface p-5"
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
            venues={connectionVenuesForDeskType(session.account.deskType)}
            next={settingsHref}
          />
        ) : null}
        <label className="block text-sm text-ink">
          Usable book share %
          <GroupedNumberInput
            name="usableBookShare"
            defaultValue={usableBookShareToInput(settings.share)}
            allowDecimal
            className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
          />
        </label>
        <p className="text-xs text-ink-muted">
          Percent of the top 5 book levels inside 5 bp of impact. 25 means
          a quarter of that in-range book. Manual Size, Dynamic clips, and
          Dynamic exits all use this number.
        </p>
      </DeskSettingsForm>
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
          No matching key on this login.
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
          <StrategyDetachControl blocked={detachBlocked} />
        </div>
      ) : null}
      {addConnection}
    </div>
  );
}
