export type DcaPlaybookUiPolicy = {
  venueId: string;
  defaultSymbol: string;
  quoteLabel: string;
  includeBoth: boolean;
};

export const BYBIT_DCA_UI: DcaPlaybookUiPolicy = {
  venueId: "bybit",
  defaultSymbol: "BTCUSDT",
  quoteLabel: "USDT",
  includeBoth: true,
};

export const HYPERLIQUID_DCA_UI: DcaPlaybookUiPolicy = {
  venueId: "hyperliquid",
  defaultSymbol: "BTC",
  quoteLabel: "USDC",
  includeBoth: false,
};
