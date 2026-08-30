"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DeskChart } from "@/components/desk-chart";
import { PanelCloseButton } from "@/components/panel-close-button";
import { buildLiveChartOverlay } from "@/lib/charts/overlay";
import {
  DCA_INDICATOR_TIMEFRAME_LABELS,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import type { CandleBar } from "@/lib/market/candles";
import type { FuturesOrder, FuturesPosition } from "@/lib/futures/model";
import type { FuturesWorkingOrder } from "@/lib/futures/working";

const CHART_INTERVALS: DcaIndicatorTimeframe[] = ["15", "60", "240", "D"];

export function PositionsChartButton({
  venue,
  venueEnvironment = null,
  symbols,
  defaultSymbol,
  positions,
  working,
  orders = [],
}: {
  venue: "bybit" | "hyperliquid";
  venueEnvironment?: string | null;
  symbols: string[];
  defaultSymbol: string;
  positions: Array<
    Pick<
      FuturesPosition,
      | "id"
      | "symbol"
      | "side"
      | "entryPrice"
      | "takeProfit"
      | "stopLoss"
      | "trailingStop"
      | "trailingActive"
    >
  >;
  working: Array<
    Pick<FuturesWorkingOrder, "id" | "symbol" | "limitPrice" | "action">
  >;
  orders?: Array<
    Pick<FuturesOrder, "id" | "action" | "price" | "filledAtMs"> & {
      symbol?: string;
    }
  >;
}) {
  const options = useMemo(() => {
    const unique = [...new Set(symbols.filter(Boolean))];
    if (!unique.includes(defaultSymbol)) {
      unique.unshift(defaultSymbol);
    }
    return unique;
  }, [symbols, defaultSymbol]);
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [interval, setInterval] = useState<DcaIndicatorTimeframe>("60");
  const [candles, setCandles] = useState<CandleBar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({
      venue,
      symbol,
      interval,
      limit: "200",
    });
    if (venue === "hyperliquid" && venueEnvironment) {
      params.set("env", venueEnvironment);
    }
    void fetch(`/api/market/candles?${params.toString()}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          candles?: CandleBar[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error || "Could not read candles.");
        }
        return body.candles ?? [];
      })
      .then((rows) => {
        if (!cancelled) {
          setCandles(rows);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCandles([]);
          setError(err instanceof Error ? err.message : "Could not read candles.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, venue, venueEnvironment, symbol, interval]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSymbol(defaultSymbol);
          setLoading(true);
          setError(null);
          setOpen(true);
        }}
        className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-sm font-medium text-ink hover:border-line-strong"
      >
        Chart
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-4"
              onClick={() => setOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`${symbol} chart`}
                className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-card border border-line bg-surface-raised p-5"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
                      Chart
                    </p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight">
                      {symbol} · {DCA_INDICATOR_TIMEFRAME_LABELS[interval]}
                    </h2>
                  </div>
                  <PanelCloseButton onClick={() => setOpen(false)} />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="text-xs text-ink-muted">
                    Contract
                    <select
                      value={symbol}
                      onChange={(event) => {
                        setLoading(true);
                        setError(null);
                        setSymbol(event.target.value);
                      }}
                      className="ml-2 rounded-control border border-line bg-canvas px-2 py-1 text-sm text-ink"
                    >
                      {options.map((row) => (
                        <option key={row} value={row}>
                          {row}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {CHART_INTERVALS.map((row) => (
                      <button
                        key={row}
                        type="button"
                        onClick={() => {
                          setLoading(true);
                          setError(null);
                          setInterval(row);
                        }}
                        className={`rounded-control px-2 py-1 text-xs ${
                          interval === row
                            ? "bg-accent-strong text-ink"
                            : "border border-line text-ink-muted hover:text-ink"
                        }`}
                      >
                        {DCA_INDICATOR_TIMEFRAME_LABELS[row]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  {loading ? (
                    <p className="text-sm text-ink-muted">Loading candles…</p>
                  ) : error ? (
                    <p className="text-sm text-danger">{error}</p>
                  ) : (
                    <DeskChart
                      candles={candles}
                      overlay={buildLiveChartOverlay({
                        symbol,
                        positions,
                        working,
                        orders,
                      })}
                    />
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
