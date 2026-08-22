"use client";

import { useState } from "react";

const ICON_SLUG: Record<string, string> = {
  BTC: "btc",
  ETH: "eth",
  SOL: "sol",
  DOGE: "doge",
  XRP: "xrp",
  MNT: "mnt",
};

export function TokenIcon({
  symbol,
  size = 20,
}: {
  symbol: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const slug = ICON_SLUG[symbol] ?? symbol.toLowerCase();
  const src = `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${slug}.svg`;

  if (failed) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-surface-raised text-[10px] font-semibold text-ink-muted"
        style={{ width: size, height: size }}
      >
        {symbol.slice(0, 1)}
      </span>
    );
  }

  return (
    // External brand marks; fallback is the letter badge above.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="inline-block rounded-full"
      onError={() => setFailed(true)}
    />
  );
}
