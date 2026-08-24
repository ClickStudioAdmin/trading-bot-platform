import Link from "next/link";
import { ColumnHint } from "@/components/column-hint";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { TokenIcon } from "@/components/token-icon";
import { formatPct, signedTone } from "@/lib/opportunities/format";
import { openPaperCarry } from "@/lib/paper/actions";
import { OpportunityBookAndSize } from "@/components/usdt-size-input";
import { type OpportunityPaperProps } from "@/lib/paper/open";
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
          <OpportunityBookAndSize
            row={row}
            paper={paper}
            formId={openFormId(row)}
          />
          {paper ? (
            <td className="px-4 py-3">
              <PaperOpenAction row={row} paper={paper} />
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
            <th className="px-4 py-3 font-medium">
              <ColumnHint
                label="Pair"
                hint="Long USDT spot and short this dated future."
              />
            </th>
            <th className="px-4 py-3 font-medium">
              <ColumnHint
                label="DTE"
                hint="Days until this future expires."
              />
            </th>
            <th className="px-4 py-3 font-medium">
              <ColumnHint
                label="Basis"
                hint="(future bid − spot ask) / spot ask. Touching the book, not mid or last."
              />
            </th>
            <th className="px-4 py-3 font-medium">
              <ColumnHint
                label="Fees + slip"
                hint="VIP0 taker on both legs (0.155%) plus 5 bp slip. USDT expiry delivery is 0. This is the cost of one open, not a round trip."
              />
            </th>
            <th className="px-4 py-3 font-medium">
              <ColumnHint
                label="Net basis"
                hint="Executable minus fees and slip. This is the entry basis used when you open a paper carry."
              />
            </th>
            <th className="px-4 py-3 font-medium">
              <ColumnHint
                label="Net APR"
                hint="Net basis × 365 / DTE. Used to rank the book."
              />
            </th>
            <th className="px-4 py-3 font-medium">
              <ColumnHint
                label="Usable book"
                hint="Your usable book share (Settings) of the top 5 book levels inside 5 bp of impact. How much size the books can take, not the full five-level book."
              />
            </th>
            {paper ? (
              <>
                <th className="px-4 py-3 font-medium">
                  <ColumnHint
                    label="Size USDT"
                    hint={
                      paper.venueOpen
                        ? "USDT notional to open on the bound exchange. Cannot exceed usable book."
                        : "Paper notional to open. Cannot exceed usable book. Each Open creates a new paper row."
                    }
                  />
                </th>
                <th className="px-4 py-3 font-medium">
                  <ColumnHint
                    label="Actions"
                    hint={
                      paper.venueOpen
                        ? "Open cash-and-carry on the bound exchange (buy spot, short the dated future)."
                        : "Open a paper carry at the live scan net basis. No Bybit order."
                    }
                  />
                </th>
              </>
            ) : null}
          </tr>
        </thead>
        <OpportunityRows rows={rows} paper={paper} />
      </table>
    </div>
  );
}

function openFormId(row: ScannedOpportunity) {
  return `open-${row.spotSymbol}-${row.futureSymbol}`;
}

function PaperOpenAction({
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
  if (!paper.canOpen) {
    return <span className="text-xs text-ink-faint">Live</span>;
  }

  return (
    <form id={openFormId(row)} action={openPaperCarry}>
      <input type="hidden" name="spotSymbol" value={row.spotSymbol} />
      <input type="hidden" name="futureSymbol" value={row.futureSymbol} />
      <input type="hidden" name="shownCapacityUsdt" value={String(row.capacityUsdt)} />
      <input type="hidden" name="next" value={paper.next} />
      <PendingSubmitButton
        pendingLabel="Opening"
        successKey={`open-${row.spotSymbol}-${row.futureSymbol}`}
        className="rounded-control bg-accent-strong px-2.5 py-1 text-xs font-medium text-ink"
      >
        Open
      </PendingSubmitButton>
    </form>
  );
}
