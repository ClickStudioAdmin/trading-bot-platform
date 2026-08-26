import { TokenIcon } from "@/components/token-icon";
import {
  formatSignedUsd,
  formatUsd,
  signedTone,
} from "@/lib/opportunities/format";

const EXPOSURE_BARS = ["bg-accent", "bg-success", "bg-warning"] as const;
const COMPACT_FROM = 3;

export function OpenStats({
  signedIn,
  notional,
  unrealized,
  exposure,
}: {
  signedIn: boolean;
  notional: number;
  unrealized: number | null;
  exposure: { baseCoin: string; notionalUsdt: number; share: number }[];
}) {
  const compact = signedIn && exposure.length >= COMPACT_FROM;
  const kpis = (
    <>
      <StatCard
        label="Open value"
        value={signedIn && notional > 0 ? formatUsd(notional) : "—"}
      />
      <StatCard
        label="Unrealized P&L"
        value={
          signedIn && unrealized !== null ? formatSignedUsd(unrealized) : "—"
        }
        toneClass={signedTone(signedIn ? unrealized : null)}
      />
    </>
  );

  return (
    <section
      className={
        compact
          ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(0,2.2fr)]"
          : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      }
    >
      {kpis}
      <div
        className={`flex h-full min-h-0 flex-col rounded-card border border-line bg-surface p-5${
          compact ? " sm:col-span-2 lg:col-span-1" : ""
        }`}
      >
        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
          Open exposure
        </p>
        {signedIn && exposure.length > 0 ? (
          <>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface-raised">
              {exposure.map((slice, index) => (
                <span
                  key={slice.baseCoin}
                  className={EXPOSURE_BARS[index % EXPOSURE_BARS.length]}
                  style={{ width: `${slice.share * 100}%` }}
                />
              ))}
            </div>
            <ul
              className={
                compact
                  ? "mt-3 grid max-h-52 gap-x-6 gap-y-1.5 overflow-y-auto text-sm sm:grid-cols-2"
                  : "mt-3 space-y-1.5 text-sm"
              }
            >
              {exposure.map((slice) => (
                <li
                  key={slice.baseCoin}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <TokenIcon symbol={slice.baseCoin} />
                    {slice.baseCoin}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-muted">
                    {formatUsd(slice.notionalUsdt)} ·{" "}
                    {(slice.share * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">
            {signedIn ? "No open exposure." : "Sign in to see exposure."}
          </p>
        )}
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  toneClass,
}: {
  label: string;
  value: string;
  toneClass?: string;
}) {
  return (
    <div className="h-full rounded-card border border-line bg-surface p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <p
        className={`mt-3 text-2xl font-semibold tracking-tight ${toneClass ?? "text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}
