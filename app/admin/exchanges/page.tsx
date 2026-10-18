import type { Metadata } from "next";
import Link from "next/link";
import { IconPencil } from "@/components/icons";
import { PageHeading } from "@/components/page-heading";
import {
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TableActions,
  TableCard,
  TableIconAction,
} from "@/components/table-chrome";
import { formatDeskType, type DeskType } from "@/lib/accounts/model";
import { availabilityCounts } from "@/lib/exchanges/availability";
import { loadExchangeAvailability } from "@/lib/exchanges/availability-store";
import { VENUES } from "@/lib/exchanges/venues";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "Exchanges",
  description: "Which exchanges members and admins can use on a new desk.",
};

export default async function AdminExchangesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = firstSearchValue(params.error);
  const cells = await loadExchangeAvailability();

  return (
    <div>
      <PageHeading overline="Admin" title="Exchanges" />
      <p className="-mt-4 mb-6 text-sm text-ink-muted">
        Integrated exchanges. Live is what members see when they create a
        desk. Testing is only for admins.
      </p>
      {error ? (
        <p className="mb-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <TableCard className="mt-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.12em] text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Exchange</th>
              <th className="px-4 py-3 font-medium">Desk types</th>
              <th className="px-4 py-3 font-medium">Live</th>
              <th className="px-4 py-3 font-medium">Testing</th>
              <th className={`${TABLE_ACTIONS_TH_CLASS} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {VENUES.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-ink-muted">
                  No exchanges are integrated.
                </td>
              </tr>
            ) : (
              VENUES.map((venue) => {
                const counts = availabilityCounts(venue.id, cells);
                return (
                  <tr key={venue.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/exchanges/${venue.id}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {venue.label}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {venue.deskTypes
                        .map((deskType) => formatDeskType(deskType as DeskType))
                        .join(", ")}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink">
                      {counts.live} of {counts.slots}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink">
                      {counts.testing} of {counts.slots}
                    </td>
                    <td className={`${TABLE_ACTIONS_TD_CLASS} text-right`}>
                      <TableActions className="justify-end">
                        <TableIconAction
                          href={`/admin/exchanges/${venue.id}`}
                          label="Edit"
                          detail="Set Live and Testing for each desk type and mode."
                        >
                          <IconPencil {...TABLE_BTN_ICON} />
                        </TableIconAction>
                      </TableActions>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}
