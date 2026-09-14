import { ColumnHint } from "@/components/column-hint";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  generatePayoutFilesAction,
  markPayoutFilePaidAction,
  rejectPayoutAction,
} from "@/lib/membership/affiliate-actions";
import type { PayoutFileRow, PayoutRow } from "@/lib/membership/affiliate-store";
import {
  PAYOUT_FILE_MAX_ROWS_DEFAULT,
  PAYOUT_FILE_MAX_ROWS_MAX,
  monthJoinedLabel,
  payoutEligibleForAirdropFile,
  payoutStatusLabel,
  shortenPayoutAddress,
  type AdminPayoutQueueStats,
} from "@/lib/membership/affiliate";
import { formatCount, formatUsd } from "@/lib/membership/billing";
import type { WalletBook } from "@/lib/membership/wallet";

export function AdminPayoutQueue({
  book,
  stats,
  files,
  payouts,
}: {
  book: WalletBook;
  stats: AdminPayoutQueueStats;
  files: PayoutFileRow[];
  payouts: PayoutRow[];
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

      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{filesTitle}</h2>
            <a
              href={exportAllHref}
              className="mt-1 inline-block text-sm text-accent hover:underline"
            >
              {exportAllLabel}
            </a>
          </div>
          <form
            action={generatePayoutFilesAction}
            className="flex flex-wrap items-end justify-end gap-3"
          >
            <input type="hidden" name="book" value={book} />
            <label className="text-sm text-ink">
              Chain
              <select
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
              </select>
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
        {files.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">{emptyFiles}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Network</th>
                  <th className="py-2 pr-3 font-medium">Payouts</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id} className="border-t border-line">
                    <td className="py-3 pr-3 text-ink-muted">
                      {monthJoinedLabel(file.createdAt)}
                    </td>
                    <td className="py-3 pr-3">{file.network}</td>
                    <td className="py-3 pr-3 tabular-nums">{file.payoutCount}</td>
                    <td className="py-3 pr-3 tabular-nums">
                      {formatUsd(file.amountUsd)}
                    </td>
                    <td className="py-3 pr-3 capitalize">{file.status}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/admin/affiliates/files/${file.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-control border border-line px-2 py-1 text-xs text-ink hover:border-line-strong"
                        >
                          View details
                        </a>
                        <a
                          href={`/admin/affiliates/files/${file.id}/export`}
                          className="rounded-control border border-line px-2 py-1 text-xs text-ink hover:border-line-strong"
                        >
                          Download CSV
                        </a>
                        {file.status === "pending" ? (
                          <form
                            action={markPayoutFilePaidAction}
                            className="flex flex-wrap gap-2"
                          >
                            <input type="hidden" name="fileId" value={file.id} />
                            <input type="hidden" name="book" value={book} />
                            <input
                              name="externalId"
                              placeholder="Airdrop tx hash"
                              className="w-36 rounded-control border border-line bg-canvas px-2 py-1 text-xs text-ink"
                            />
                            <PendingSubmitButton
                              pendingLabel="…"
                              className="rounded-control bg-accent-strong px-2 py-1 text-xs font-medium text-ink"
                            >
                              Mark file paid
                            </PendingSubmitButton>
                          </form>
                        ) : (
                          <span className="text-xs text-ink-faint">
                            {file.externalId ?? "Paid"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">{queueTitle}</h2>
        {payouts.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">{emptyQueue}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Member</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Network</th>
                  <th className="py-2 pr-3 font-medium">Address</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id} className="border-t border-line">
                    <td className="py-3 pr-3 text-ink-muted">
                      {monthJoinedLabel(payout.createdAt)}
                    </td>
                    <td className="py-3 pr-3">{payout.email ?? payout.userId}</td>
                    <td className="py-3 pr-3 tabular-nums">
                      {formatUsd(payout.amountUsd)}
                    </td>
                    <td className="py-3 pr-3">{payout.network ?? "—"}</td>
                    <td
                      className="py-3 pr-3 font-mono text-xs"
                      title={payout.address ?? undefined}
                    >
                      {shortenPayoutAddress(payout.address)}
                    </td>
                    <td className="py-3 pr-3">
                      {payoutStatusLabel(payout.status)}
                      {payout.payoutFileId ? (
                        <span className="block text-xs text-ink-faint">
                          File {payout.payoutFileId.slice(0, 8)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3">
                      {payoutEligibleForAirdropFile(payout.status) ? (
                        <form action={rejectPayoutAction}>
                          <input
                            type="hidden"
                            name="payoutId"
                            value={payout.id}
                          />
                          <input type="hidden" name="book" value={book} />
                          <PendingSubmitButton
                            pendingLabel="…"
                            className="rounded-control border border-line px-2 py-1 text-xs text-danger hover:border-line-strong"
                          >
                            Reject
                          </PendingSubmitButton>
                        </form>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        <ColumnHint label={label} hint={hint} />
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}
