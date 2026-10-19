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
import { formatDeskDisplayMode, formatDeskType } from "@/lib/accounts/model";
import {
  EXCHANGE_DESK_MODES,
  availabilitySetting,
  availabilityStatusLabel,
  exchangeListDeskTypes,
} from "@/lib/exchanges/availability";
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
        Integrated exchanges. In Development is for developers and admins.
        Testing is for platform testers, developers, and admins. Members only
        see Beta and Live. Beta shows a beta notice. Live is what members see
        when they create a desk.
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
              <th className="px-4 py-3 font-medium">Desk type</th>
              {EXCHANGE_DESK_MODES.map((mode) => (
                <th key={mode} className="px-4 py-3 font-medium">
                  {formatDeskDisplayMode(mode)}
                </th>
              ))}
              <th className={`${TABLE_ACTIONS_TH_CLASS} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {VENUES.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-ink-muted">
                  No exchanges are integrated.
                </td>
              </tr>
            ) : (
              VENUES.map((venue, venueIndex) => {
                const deskTypes = exchangeListDeskTypes(venue);
                return deskTypes.map((row, typeIndex) => {
                  const first = typeIndex === 0;
                  const last =
                    venueIndex === VENUES.length - 1 &&
                    typeIndex === deskTypes.length - 1;
                  const deskType = row.deskType;
                  return (
                    <tr
                      key={`${venue.id}:${deskType}`}
                      className={last ? "" : "border-b border-line"}
                    >
                      {first ? (
                        <td
                          rowSpan={deskTypes.length}
                          className="px-4 py-3 align-top"
                        >
                          <Link
                            href={`/admin/exchanges/${venue.id}`}
                            className="font-medium text-ink hover:text-accent"
                          >
                            {venue.label}
                          </Link>
                        </td>
                      ) : null}
                      <td className="px-4 py-3 text-ink">
                        {formatDeskType(deskType)}
                      </td>
                      {row.offered ? (
                        EXCHANGE_DESK_MODES.map((mode) => {
                          const setting = availabilitySetting(
                            cells,
                            venue.id,
                            deskType,
                            mode,
                          );
                          return (
                            <td
                              key={mode}
                              className={`px-4 py-3 ${
                                setting === "in_development"
                                  ? "text-ink-muted"
                                  : setting === "testing"
                                    ? "text-warning"
                                    : setting === "beta"
                                      ? "text-accent"
                                      : "text-ink"
                              }`}
                            >
                              {availabilityStatusLabel(setting)}
                            </td>
                          );
                        })
                      ) : (
                        <td
                          colSpan={EXCHANGE_DESK_MODES.length}
                          className="px-4 py-3 text-ink-faint"
                        >
                          NA
                        </td>
                      )}
                      {first ? (
                        <td
                          rowSpan={deskTypes.length}
                          className={`${TABLE_ACTIONS_TD_CLASS} align-top text-right`}
                        >
                          <TableActions className="justify-end">
                            <TableIconAction
                              href={`/admin/exchanges/${venue.id}`}
                              label="Edit"
                              detail="Set In Development, Testing, Beta, or Live for each desk type and mode."
                            >
                              <IconPencil {...TABLE_BTN_ICON} />
                            </TableIconAction>
                          </TableActions>
                        </td>
                      ) : null}
                    </tr>
                  );
                });
              })
            )}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}
