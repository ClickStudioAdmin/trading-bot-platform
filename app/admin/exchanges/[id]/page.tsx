import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppRadio } from "@/components/app-check";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { formatDeskDisplayMode, formatDeskType, type DeskType } from "@/lib/accounts/model";
import { saveExchangeAvailability } from "@/lib/exchanges/availability-actions";
import {
  EXCHANGE_DESK_MODES,
  availabilitySetting,
  deskTypesInSidebarOrder,
  isVenueDeskType,
} from "@/lib/exchanges/availability";
import { loadExchangeAvailability } from "@/lib/exchanges/availability-store";
import { getVenue, VENUES, type VenueDeskType } from "@/lib/exchanges/venues";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "Edit exchange",
  description: "Live and Testing for each desk type and mode.",
};

const ALL_DESK_TYPES: VenueDeskType[] = [
  "cash_and_carry",
  "manual",
  "flex",
  "signal_follower",
  "dca",
];

export default async function AdminExchangePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const venue = getVenue(id);
  if (!venue || !VENUES.some((row) => row.id === venue.id)) {
    notFound();
  }
  const query = await searchParams;
  const error = firstSearchValue(query.error);
  const saved = firstSearchValue(query.saved) === "1";
  const cells = await loadExchangeAvailability();
  const unsupported = ALL_DESK_TYPES.filter(
    (deskType) => !venue.deskTypes.includes(deskType),
  );

  return (
    <div>
      <Breadcrumbs
        items={[
          { href: "/admin/exchanges", label: "Exchanges" },
          { label: venue.label },
        ]}
      />
      <PageHeading title={venue.label} />
      <p className="-mt-4 text-sm text-ink-muted">
        Each desk type and mode is Live, Testing, or Beta. Live lets members
        pick this exchange when they create a desk. Testing lets admins pick
        it and use it while you test. Beta lets members pick it, and that
        desk shows a beta notice. Desks that already exist stay as they are.
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Exchange settings saved.
        </p>
      ) : null}
      <form
        action={saveExchangeAvailability}
        className="mt-6 space-y-6 rounded-card border border-line bg-surface p-5"
      >
        <input type="hidden" name="venue" value={venue.id} />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Environments and Mode
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Paper uses public marks on the in-app ledger. Demo is the exchange
            demo or testnet. Live is the exchange live environment.
          </p>
        </div>
        {deskTypesInSidebarOrder(venue.deskTypes).map((deskType) => (
          <section key={deskType}>
            <h3 className="text-sm font-semibold text-ink">
              {isVenueDeskType(deskType) ? formatDeskType(deskType) : deskType}
            </h3>
            <table className="mt-3 min-w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-ink-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Mode</th>
                  <th className="px-4 py-2 font-medium">Live</th>
                  <th className="px-4 py-2 font-medium">Testing</th>
                  <th className="px-4 py-2 font-medium">Beta</th>
                </tr>
              </thead>
              <tbody>
                {EXCHANGE_DESK_MODES.map((mode) => {
                  const setting = availabilitySetting(
                    cells,
                    venue.id,
                    deskType,
                    mode,
                  );
                  const modeLabel = formatDeskDisplayMode(mode);
                  const typeLabel = formatDeskType(deskType as DeskType);
                  const group = `availability:${deskType}:${mode}`;
                  return (
                    <tr key={mode} className="border-b border-line last:border-0">
                      <td className="py-3 pr-4 text-ink">{modeLabel}</td>
                      {(
                        [
                          ["live", "Live"],
                          ["testing", "Testing"],
                          ["beta", "Beta"],
                        ] as const
                      ).map(([value, label]) => (
                        <td key={value} className="px-4 py-3">
                          <AppRadio
                            name={group}
                            value={value}
                            defaultChecked={setting === value}
                            aria-label={`${typeLabel} ${modeLabel} ${label}`}
                            className=""
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
        {unsupported.length > 0 ? (
          <p className="text-sm text-ink-muted">
            {unsupported
              .map((deskType) => formatDeskType(deskType))
              .join(", ")}{" "}
            {unsupported.length === 1 ? "stays" : "stay"} off. {venue.label}{" "}
            cannot run {unsupported.length === 1 ? "that desk type" : "those desk types"}.
          </p>
        ) : null}
        <PendingSubmitButton
          pendingLabel="Saving…"
          className="inline-flex items-center rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          Save
        </PendingSubmitButton>
      </form>
    </div>
  );
}
