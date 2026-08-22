import Link from "next/link";
import { TokenIcon } from "@/components/token-icon";
import { formatPct, formatUsd, signedTone } from "@/lib/opportunities/format";
import { openPaperCarry } from "@/lib/paper/actions";
import { UsdtSizeInput } from "@/components/usdt-size-input";
import {
  DEFAULT_PAPER_NOTIONAL_USDT,
  pairKey,
  type OpportunityPaperProps,
} from "@/lib/paper/open";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";

export function OpportunityRows({
  rows,
  paper,
}: {
  rows: ScannedOpportunity[];
  paper?: OpportunityPaperProps;
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
          {paper ? (
            <td className="px-4 py-3">
              <PaperOpenCell row={row} paper={paper} />
            </td>
          ) : null}
        </tr>
      ))}
    </tbody>
  );
}

export function OpportunityTable({
  rows,
  paper,
}: {
  rows: ScannedOpportunity[];
  paper?: OpportunityPaperProps;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[60rem] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
          <tr>
            <th className="px-4 py-3 font-medium">Pair</th>
            <th className="px-4 py-3 font-medium">DTE</th>
            <th className="px-4 py-3 font-medium">Exec. basis</th>
            <th className="px-4 py-3 font-medium">Fees + slip</th>
            <th className="px-4 py-3 font-medium">Net basis</th>
            <th className="px-4 py-3 font-medium">Net APR</th>
            <th className="px-4 py-3 font-medium">Capacity</th>
            {paper ? <th className="px-4 py-3 font-medium">Size USDT</th> : null}
          </tr>
        </thead>
        <OpportunityRows rows={rows} paper={paper} />
      </table>
    </div>
  );
}

function PaperOpenCell({
  row,
  paper,
}: {
  row: ScannedOpportunity;
  paper: OpportunityPaperProps;
}) {
  if (!paper.signedIn) {
    return (
      <Link href="/sign-in" className="text-accent hover:text-accent-strong">
        Sign in
      </Link>
    );
  }

  if (paper.openKeys.has(pairKey(row.spotSymbol, row.futureSymbol))) {
    return <span className="text-xs text-success">Open</span>;
  }

  return (
    <form action={openPaperCarry} className="flex items-center gap-2">
      <input type="hidden" name="spotSymbol" value={row.spotSymbol} />
      <input type="hidden" name="futureSymbol" value={row.futureSymbol} />
      <input type="hidden" name="next" value={paper.next} />
      <UsdtSizeInput
        name="notionalUsdt"
        defaultValue={DEFAULT_PAPER_NOTIONAL_USDT}
        ariaLabel={`Paper size in USDT for ${row.futureSymbol}`}
      />
      <button
        type="submit"
        className="rounded-control bg-accent-strong px-2.5 py-1 text-xs font-medium text-ink"
      >
        Open
      </button>
    </form>
  );
}
