import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { savePaperSettings } from "@/lib/engine/actions";
import { loadEngineSettings } from "@/lib/engine/settings";
import {
  formatConnectionSummary,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { usableBookShareToInput } from "@/lib/opportunities/capacity";
import { firstSearchValue } from "@/lib/paper/open";
import { getSessionContext } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Strategy Settings",
  description: "Cash-and-carry strategy settings.",
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
  const live = accountCanHoldConnections(session.account.mode);
  const connections = live
    ? await listExchangeConnections(session.member.id, session.account.id)
    : [];
  const selected = connections.find((row) => row.id === settings.connectionId) ?? null;
  const saved = firstSearchValue(params.saved) === "1";
  const error = firstSearchValue(params.error);

  return (
    <main className="mx-auto max-w-6xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Strategy Settings" />
      <p className="-mt-4 text-sm text-ink-muted">
        Strategy-wide knobs. Automations stay on their own page.
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
        action={savePaperSettings}
        className="mt-6 max-w-md space-y-4 rounded-card border border-line bg-surface p-5"
      >
        {live ? (
          <ExchangeBindField
            connections={connections}
            selectedId={settings.connectionId}
            selected={selected}
          />
        ) : null}
        <label className="block text-sm text-ink">
          Usable book share %
          <input
            name="usableBookShare"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={usableBookShareToInput(settings.share)}
            className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
          />
        </label>
        <p className="text-xs text-ink-muted">
          Percent of the top 5 book levels inside 5 bp of impact. 25 means
          a quarter of that in-range book. Manual Size, Dynamic clips, and
          Dynamic exits all use this number.
        </p>
        <PendingSubmitButton
          pendingLabel="Saving…"
          successKey="save-settings"
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
}: {
  connections: ExchangeConnection[];
  selectedId: string | null;
  selected: ExchangeConnection | null;
}) {
  if (connections.length === 0) {
    return (
      <div>
        <p className="text-sm text-ink">Exchange</p>
        <p className="mt-1 text-sm text-ink-muted">
          Connect an exchange to start trading.{" "}
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
    <label className="block text-sm text-ink">
      Exchange
      <select
        name="exchangeConnectionId"
        defaultValue={selectedId ?? "none"}
        className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
      >
        <option value="none">None</option>
        {options.map((row) => (
          <option key={row.id} value={row.id}>
            {formatConnectionSummary(row)}
            {row.status === "invalid" ? " (Invalid)" : ""}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs text-ink-muted">
        {selected
          ? `Cash and Carry uses ${formatConnectionSummary(selected)}. Detach is blocked while this strategy has open positions or automations on.`
          : "Pick an active connection on this Live account. Manual Open, Close, and Unwind still work without one; live execution will need it later."}
      </span>
    </label>
  );
}
