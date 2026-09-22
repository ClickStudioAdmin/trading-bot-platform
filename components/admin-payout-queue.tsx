import {
  AdminPayoutFilesTable,
  AdminPayoutQueueTable,
} from "@/components/admin-payout-tables";
import { ColumnHint } from "@/components/column-hint";
import { IconDownload } from "@/components/icons";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { TABLE_BTN_ICON, TableLabelButton } from "@/components/table-chrome";
import { generatePayoutFilesAction } from "@/lib/membership/affiliate-actions";
import type { PayoutFileRow, PayoutRow } from "@/lib/membership/affiliate-store";
import {
  PAYOUT_FILE_MAX_ROWS_DEFAULT,
  PAYOUT_FILE_MAX_ROWS_MAX,
  type AdminPayoutQueueStats,
} from "@/lib/membership/affiliate";
import { formatCount, formatUsd } from "@/lib/membership/billing";
import type { WalletBook } from "@/lib/membership/wallet";
import { AppSelect } from "@/components/app-select";

export function AdminPayoutQueue({
  book,
  stats,
  files,
  payouts,
  fileStatus = "",
  fileQ = "",
  payoutStatus = "",
  keep,
}: {
  book: WalletBook;
  stats: AdminPayoutQueueStats;
  files: PayoutFileRow[];
  payouts: PayoutRow[];
  fileStatus?: string;
  fileQ?: string;
  payoutStatus?: string;
  keep?: Record<string, string | undefined>;
}) {
  const filesNoun = book === "main" ? "withdrawal lists" : "payout lists";
  const filesTitle = book === "main" ? "Withdrawal files" : "Payout files";
  const queueTitle = book === "main" ? "Withdrawal queue" : "Payout queue";
  const exportAllHref =
    book === "main"
      ? "/admin/billing/export"
      : "/admin/affiliates/export";
  const exportAllLabel =
    book === "main" ? "Export all withdrawals" : "Export all payouts";
  const emptyFiles =
    book === "main" ? "No withdrawal files yet." : "No payout files yet.";
  const emptyQueue =
    book === "main" ? "No withdrawals yet." : "No payouts yet.";

  return (
    <>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Required to payout"
          value={formatUsd(stats.outstandingUsd)}
          hint="USDT still owed: requests not yet on a list plus payments on pending files."
        />
        <StatTile
          label="To generate"
          value={formatUsd(stats.readyUsd)}
          hint={`${formatCount(stats.readyCount)} request${stats.readyCount === 1 ? "" : "s"} with a chain and address. Generate ${filesNoun} to add them to a file.`}
        />
        <StatTile
          label="On payout lists"
          value={formatUsd(stats.toSendUsd)}
          hint={`${formatCount(stats.toSendCount)} payment${stats.toSendCount === 1 ? "" : "s"} on ${formatCount(stats.pendingFileCount)} pending file${stats.pendingFileCount === 1 ? "" : "s"}. This is the USDT to send in the next airdrop.`}
        />
        <StatTile
          label="Paid out"
          value={formatUsd(stats.paidUsd)}
          hint={`${formatCount(stats.paidCount)} payment${stats.paidCount === 1 ? "" : "s"} already marked paid.`}
        />
      </section>
      {stats.toSendByNetwork.length > 0 ? (
        <p className="mt-3 text-sm text-ink-muted">
          To send by chain:{" "}
          {stats.toSendByNetwork
            .map(
              (row) =>
                `${row.network} ${formatUsd(row.amountUsd)} (${formatCount(row.count)})`,
            )
            .join(" · ")}
        </p>
      ) : null}

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{filesTitle}</h2>
            <TableLabelButton
              href={exportAllHref}
              variant="secondary"
              className="mt-1"
              icon={<IconDownload {...TABLE_BTN_ICON} />}
            >
              {exportAllLabel}
            </TableLabelButton>
          </div>
          <form
            action={generatePayoutFilesAction}
            className="flex flex-wrap items-end justify-end gap-3"
          >
            <input type="hidden" name="book" value={book} />
            <label className="text-sm text-ink">
              Chain
              <AppSelect
                name="network"
                className="mt-1 block min-w-[10rem] rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
                defaultValue=""
              >
                <option value="">All chains</option>
                {stats.readyByNetwork.map((row) => (
                  <option key={row.network} value={row.network}>
                    {row.network}
                  </option>
                ))}
              </AppSelect>
            </label>
            <label className="text-sm text-ink">
              Max rows
              <input
                name="maxRows"
                type="number"
                inputMode="numeric"
                min={1}
                max={PAYOUT_FILE_MAX_ROWS_MAX}
                required
                defaultValue={PAYOUT_FILE_MAX_ROWS_DEFAULT}
                className="mt-1 block w-24 rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="text-sm text-ink">
              Max amount
              <input
                name="maxAmountUsd"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="No cap"
                className="mt-1 block w-28 rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
              />
            </label>
            <PendingSubmitButton
              pendingLabel="Generating…"
              className="rounded-control bg-accent-strong px-3 py-2 text-sm font-medium text-ink"
            >
              Generate {filesNoun}
            </PendingSubmitButton>
          </form>
        </div>
        {files.length === 0 && !fileStatus && !fileQ ? (
          <p className="mt-4 text-sm text-ink-muted">{emptyFiles}</p>
        ) : (
          <AdminPayoutFilesTable
            files={
              fileStatus
                ? files.filter((file) => file.status === fileStatus)
                : files
            }
            book={book}
            fileStatus={fileStatus}
            fileQ={fileQ}
            keep={{ ...keep, payoutStatus }}
          />
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">{queueTitle}</h2>
        {payouts.length === 0 && !payoutStatus ? (
          <p className="mt-4 text-sm text-ink-muted">{emptyQueue}</p>
        ) : (
          <AdminPayoutQueueTable
            payouts={
              payoutStatus
                ? payouts.filter((payout) => payout.status === payoutStatus)
                : payouts
            }
            book={book}
            payoutStatus={payoutStatus}
            keep={{ ...keep, fileStatus, fileQ }}
          />
        )}
      </section>
    </>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        <ColumnHint label={label} hint={hint} />
      </p>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}
