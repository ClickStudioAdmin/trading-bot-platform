"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { iconLookupKeys, iconUrlForSymbol } from "@/lib/market/icons";

type IconMap = Record<string, string>;

let cached: IconMap | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  void ensureIcons();
  return () => {
    listeners.delete(onStoreChange);
  };
}

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

async function ensureIcons() {
  if (cached || inflight) {
    return inflight;
  }
  inflight = fetch("/api/market/icons")
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Icons HTTP ${response.status}`);
      }
      const body = (await response.json()) as { icons?: IconMap };
      cached = body.icons ?? {};
    })
    .catch(() => {
      cached = cached ?? {};
    })
    .finally(() => {
      inflight = null;
      emit();
    });
  return inflight;
}

function useMarketIcons(): IconMap | null {
  return useSyncExternalStore(
    subscribe,
    () => cached,
    () => null,
  );
}

export function TokenIcon({
  symbol,
  size = 20,
}: {
  symbol: string;
  size?: number;
}) {
  const icons = useMarketIcons();
  const [failed, setFailed] = useState(false);
  const keys = iconLookupKeys(symbol);
  const label = keys[keys.length - 1] ?? symbol;
  const src = icons ? iconUrlForSymbol(icons, symbol) : null;

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-raised text-[10px] font-semibold text-ink-muted"
        style={{ width: size, height: size }}
      >
        {icons ? label.slice(0, 1) : ""}
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
      loading="lazy"
      decoding="async"
      className="inline-block shrink-0 rounded-full"
      onError={() => setFailed(true)}
    />
  );
}
