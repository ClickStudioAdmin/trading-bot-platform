"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyLiveMarks,
  type LiveTickerQuote,
  type MarkedFutures,
} from "@/lib/futures/mark";

const LIVE_MS = 2_000;

type LiveTickerMap = Map<string, LiveTickerQuote>;

const LiveTickerContext = createContext<LiveTickerMap | null>(null);

export function LiveTickerScope({
  symbols,
  venue,
  environment,
  children,
}: {
  symbols: readonly string[];
  venue?: string;
  environment?: string | null;
  children: ReactNode;
}) {
  const key = [...new Set(symbols.filter(Boolean))].sort().join(",");
  const query =
    venue === "hyperliquid"
      ? `${key}&env=${environment === "testnet" || environment === "demo" ? "testnet" : "live"}`
      : key;
  const [tickers, setTickers] = useState<LiveTickerMap | null>(null);

  useEffect(() => {
    if (!key) {
      return;
    }
    let timer = 0;
    let dead = false;

    async function pull() {
      if (document.hidden) {
        return;
      }
      try {
        const res = await fetch(`/api/market/tickers?symbols=${query}`);
        if (!res.ok) {
          return;
        }
        const body = (await res.json()) as {
          tickers?: Record<string, LiveTickerQuote>;
        };
        if (dead) {
          return;
        }
        const next = new Map<string, LiveTickerQuote>();
        for (const [symbol, quote] of Object.entries(body.tickers ?? {})) {
          next.set(symbol, quote);
        }
        setTickers(next);
      } catch {
        return;
      }
    }

    function start() {
      window.clearInterval(timer);
      if (document.hidden) {
        return;
      }
      void pull();
      timer = window.setInterval(() => {
        void pull();
      }, LIVE_MS);
    }

    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      dead = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", start);
    };
  }, [key, query]);

  return (
    <LiveTickerContext.Provider value={tickers}>
      {children}
    </LiveTickerContext.Provider>
  );
}

export function useLiveMarkedOpen(open: MarkedFutures[]): MarkedFutures[] {
  const tickers = useContext(LiveTickerContext);
  return useMemo(() => applyLiveMarks(open, tickers), [open, tickers]);
}
