import { formatSignedUsd, formatUsd, signedTone } from "@/lib/opportunities/format";

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
  const value = signedIn && notional > 0 ? formatUsd(notional) : "—";
  const pnl =
    signedIn && unrealized !== null ? formatSignedUsd(unrealized) : "—";
  const exposureText =
    signedIn && exposure.length > 0
      ? exposure
          .map(
            (slice) =>
              `${slice.baseCoin} ${formatUsd(slice.notionalUsdt)} · ${(slice.share * 100).toFixed(0)}%`,
          )
          .join(", ")
      : "—";

  return (
    <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
      <span>
        <span className="text-ink-muted">Open value </span>
        <span className="font-medium tabular-nums text-ink">{value}</span>
      </span>
      <span>
        <span className="text-ink-muted">Unrealized P&L </span>
        <span
          className={`font-medium tabular-nums ${signedTone(signedIn ? unrealized : null) || "text-ink"}`}
        >
          {pnl}
        </span>
      </span>
      <span className="min-w-0">
        <span className="text-ink-muted">Open exposure </span>
        <span className="font-medium tabular-nums text-ink">{exposureText}</span>
      </span>
    </p>
  );
}
