import type { FuturesTradeSource } from "@/lib/futures/model";
import { formatFuturesSourceKind } from "@/lib/futures/source";

export function FuturesSourceCell({
  source,
  ruleName,
}: {
  source: FuturesTradeSource;
  ruleName?: string | null;
}) {
  const name = String(ruleName ?? "").trim();
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="w-fit rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-normal whitespace-nowrap text-accent">
        {formatFuturesSourceKind(source)}
      </span>
      {name ? (
        <span className="text-xs text-ink-muted" title={name}>
          {name}
        </span>
      ) : null}
    </span>
  );
}
