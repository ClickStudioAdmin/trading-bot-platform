import type { ReactNode } from "react";
import type { FuturesTradeSource } from "@/lib/futures/model";
import { formatFuturesSourceKind } from "@/lib/futures/source";

export function FuturesSourceCell({
  source,
  ruleName,
  name,
  footer,
  webhookNames,
}: {
  source: FuturesTradeSource;
  ruleName?: string | null;
  name?: ReactNode;
  footer?: ReactNode;
  webhookNames?: readonly string[];
}) {
  const text = String(ruleName ?? "").trim();
  const label =
    name ??
    (text ? (
      <span className="truncate text-xs text-ink-muted" title={text}>
        {text}
      </span>
    ) : null);
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="w-fit rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-normal whitespace-nowrap text-accent">
        {formatFuturesSourceKind(source, ruleName, webhookNames)}
      </span>
      {label}
      {footer}
    </span>
  );
}
