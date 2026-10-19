"use client";

import { createContext, useContext } from "react";

const DeskChartSymbolContext = createContext<((symbol: string) => void) | null>(
  null,
);

export const DeskChartSymbolProvider = DeskChartSymbolContext.Provider;

export function useReportDeskChartSymbol(): ((symbol: string) => void) | null {
  return useContext(DeskChartSymbolContext);
}
