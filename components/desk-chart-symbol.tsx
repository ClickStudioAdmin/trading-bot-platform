"use client";

import { createContext, useContext } from "react";

const DeskChartSymbolContext = createContext<((symbol: string) => void) | null>(
  null,
);
const DeskChartSymbolValueContext = createContext<string | null>(null);

export const DeskChartSymbolProvider = DeskChartSymbolContext.Provider;
export const DeskChartSymbolValueProvider = DeskChartSymbolValueContext.Provider;

export function useReportDeskChartSymbol(): ((symbol: string) => void) | null {
  return useContext(DeskChartSymbolContext);
}

export function useDeskChartSymbol(): string | null {
  return useContext(DeskChartSymbolValueContext);
}
