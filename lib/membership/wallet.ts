export const WALLET_BOOKS = ["main", "affiliate"] as const;
export type WalletBook = (typeof WALLET_BOOKS)[number];

export const WALLET_KINDS = [
  "deposit",
  "debit_rent",
  "commission",
  "withdraw",
  "adjust",
  "transfer_in",
  "transfer_out",
] as const;
export type WalletKind = (typeof WALLET_KINDS)[number];

export const TOKEN_KINDS = ["stable", "native", "wbtc", "other"] as const;
export type TokenKind = (typeof TOKEN_KINDS)[number];

export const BILLING_CHAIN_ENVS = ["development", "production"] as const;
export type BillingChainEnvironment = (typeof BILLING_CHAIN_ENVS)[number];

export const WALLET_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export type WalletBookBalances = {
  main: number;
  affiliate: number;
};

export type WalletEntryLike = {
  book?: string | null;
  kind: string;
  amountUsd: number;
};

export type PlanDeductDecision =
  | { ok: true; transferUsd: number }
  | { ok: false; shortUsd: number };

export function billingChainEnvironment(): BillingChainEnvironment {
  return process.env.VERCEL_ENV === "production" ? "production" : "development";
}

export function parseWalletBook(value: unknown): WalletBook | null {
  return WALLET_BOOKS.includes(value as WalletBook)
    ? (value as WalletBook)
    : null;
}

export function parseWalletKind(value: unknown): WalletKind | null {
  return WALLET_KINDS.includes(value as WalletKind)
    ? (value as WalletKind)
    : null;
}

export function parseTokenKind(value: unknown): TokenKind | null {
  return TOKEN_KINDS.includes(value as TokenKind)
    ? (value as TokenKind)
    : null;
}

export function inferWalletBook(kind: string, book?: string | null): WalletBook {
  const parsed = parseWalletBook(book);
  if (parsed) {
    return parsed;
  }
  return kind === "commission" ? "affiliate" : "main";
}

export function roundUsd(amount: number): number {
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.round(amount * 100) / 100;
}

export function walletEntryDelta(kind: string, amountUsd: number): number {
  if (!Number.isFinite(amountUsd)) {
    return 0;
  }
  if (kind === "deposit" || kind === "commission" || kind === "transfer_in") {
    return Math.abs(amountUsd);
  }
  if (
    kind === "debit_rent" ||
    kind === "withdraw" ||
    kind === "transfer_out"
  ) {
    return -Math.abs(amountUsd);
  }
  return amountUsd;
}

export function bookBalancesFromEntries(
  rows: WalletEntryLike[],
): WalletBookBalances {
  const balances: WalletBookBalances = { main: 0, affiliate: 0 };
  for (const row of rows) {
    const book = inferWalletBook(row.kind, row.book);
    balances[book] = roundUsd(
      balances[book] + walletEntryDelta(row.kind, row.amountUsd),
    );
  }
  return balances;
}

export function planDeductDecision(input: {
  priceUsd: number;
  mainUsd: number;
  affiliateUsd: number;
  useAffiliate: boolean;
}): PlanDeductDecision {
  const price = roundUsd(input.priceUsd);
  const main = roundUsd(input.mainUsd);
  const affiliate = Math.max(0, roundUsd(input.affiliateUsd));
  if (price < 0.01) {
    return { ok: false, shortUsd: 0 };
  }
  if (main + 1e-9 >= price) {
    return { ok: true, transferUsd: 0 };
  }
  const need = roundUsd(price - main);
  if (input.useAffiliate && affiliate + 1e-9 >= need) {
    return { ok: true, transferUsd: need };
  }
  const available = main + (input.useAffiliate ? affiliate : 0);
  return { ok: false, shortUsd: roundUsd(Math.max(0, price - available)) };
}

export function tokenAmountToUsd(
  amount: bigint,
  decimals: number,
  kind: string,
): number | null {
  if (kind !== "stable") {
    return null;
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    return null;
  }
  if (amount <= BigInt(0)) {
    return null;
  }
  const whole = Number(amount) / 10 ** decimals;
  if (!Number.isFinite(whole) || whole < 0.01) {
    return null;
  }
  return roundUsd(whole);
}

export function walletInvoiceExternalId(
  userId: string,
  periodStartIso: string,
): string {
  return `wallet:${userId}:${periodStartIso}`;
}

export function explorerAddressUrl(
  explorerUrl: string | null,
  address: string,
): string | null {
  const base = explorerUrl?.trim().replace(/\/$/, "") ?? "";
  if (!base) {
    return null;
  }
  return `${base}/address/${address}`;
}

export function explorerTxUrl(
  explorerUrl: string | null,
  txHash: string,
): string | null {
  const base = explorerUrl?.trim().replace(/\/$/, "") ?? "";
  if (!base) {
    return null;
  }
  return `${base}/tx/${txHash}`;
}
