import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import { formatPct, formatUsd, signedTone } from "@/lib/opportunities/format";
import { TokenIcon } from "@/components/token-icon";

export function OpportunityRows({
  rows,
}: {
  rows: ScannedOpportunity[];
}) {
  return (
    <tbody>
      {rows.map((row) => (
        <tr
          key={`${row.spotSymbol}-${row.futureSymbol}`}
          className="border-b border-line last:border-b-0"
        >
          <td className="px-4 py-3">
            <span className="flex items-center gap-2 font-medium">
              <TokenIcon symbol={row.baseCoin} />
              {row.baseCoin}
            </span>
            <span className="mt-0.5 block pl-7 text-xs text-ink-faint">
              {row.futureSymbol}
            </span>
          </td>
          <td className="px-4 py-3 tabular-nums text-ink-muted">
            {row.daysToExpiry > 0 ? row.daysToExpiry.toFixed(1) : "—"}
          </td>
          <td
            className={`px-4 py-3 tabular-nums ${signedTone(row.executableBasis)}`}
          >
            {formatPct(row.executableBasis)}
          </td>
          <td className="px-4 py-3 tabular-nums text-ink-muted">
            {formatPct(row.feeRate)}
          </td>
          <td className={`px-4 py-3 tabular-nums ${signedTone(row.netBasis)}`}>
            {formatPct(row.netBasis)}
          </td>
          <td className={`px-4 py-3 tabular-nums ${signedTone(row.netApr)}`}>
            {formatPct(row.netApr)}
          </td>
          <td className="px-4 py-3 tabular-nums text-ink-muted">
            {formatUsd(row.capacityUsdt)}
          </td>
        </tr>
      ))}
    </tbody>
  );
}

export function OpportunityTable({
  rows,
}: {
  rows: ScannedOpportunity[];
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
          <tr>
            <th className="px-4 py-3 font-medium">Pair</th>
            <th className="px-4 py-3 font-medium">DTE</th>
            <th className="px-4 py-3 font-medium">Exec. basis</th>
            <th className="px-4 py-3 font-medium">Fees + slip</th>
            <th className="px-4 py-3 font-medium">Net basis</th>
            <th className="px-4 py-3 font-medium">Net APR</th>
            <th className="px-4 py-3 font-medium">Capacity</th>
          </tr>
        </thead>
        <OpportunityRows rows={rows} />
      </table>
    </div>
  );
}
