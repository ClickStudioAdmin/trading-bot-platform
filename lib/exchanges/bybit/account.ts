import { bybitPrivateRequest, type BybitPrivateCreds } from "./private";
import type { VenueAccountSnapshot, VenueMarginMode } from "@/lib/exchanges/account-view";

export type { VenueAccountSnapshot, VenueMarginMode } from "@/lib/exchanges/account-view";
export {
  formatMarginModeLabel,
  formatMarginModeWithLeverage,
  formatSnapshotMoney,
  marginRateTone,
  pickDisplayLeverage,
} from "@/lib/exchanges/account-view";

type WalletResult = {
  list?: Array<{
    accountIMRate?: string;
    accountMMRate?: string;
    totalMarginBalance?: string;
    totalAvailableBalance?: string;
  }>;
};

type AccountInfoResult = {
  marginMode?: string;
};

export function parseBybitMarginMode(raw: unknown): VenueMarginMode | null {
  const mode = String(raw ?? "").trim().toUpperCase();
  if (mode === "REGULAR_MARGIN") {
    return "cross";
  }
  if (mode === "ISOLATED_MARGIN") {
    return "isolated";
  }
  if (mode === "PORTFOLIO_MARGIN") {
    return "portfolio";
  }
  return null;
}

export function parseBybitAccountMoney(raw: unknown): number | null {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function parseBybitAccountRate(raw: unknown): number | null {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function snapshotFromBybit(input: {
  wallet?: WalletResult | null;
  info?: AccountInfoResult | null;
}): VenueAccountSnapshot | null {
  const row = input.wallet?.list?.[0];
  if (!row) {
    return null;
  }
  const marginMode = parseBybitMarginMode(input.info?.marginMode);
  const isolated = marginMode === "isolated";
  return {
    marginMode,
    leverage: null,
    initialMarginRate: isolated
      ? null
      : parseBybitAccountRate(row.accountIMRate),
    maintenanceMarginRate: isolated
      ? null
      : parseBybitAccountRate(row.accountMMRate),
    marginBalance: parseBybitAccountMoney(row.totalMarginBalance),
    availableBalance: parseBybitAccountMoney(row.totalAvailableBalance),
  };
}

export async function bybitReadAccountSnapshot(input: {
  environmentId: string;
  credentials: BybitPrivateCreds;
}): Promise<
  { ok: true; snapshot: VenueAccountSnapshot } | { ok: false; error: string }
> {
  const [wallet, info] = await Promise.all([
    bybitPrivateRequest<WalletResult>({
      environmentId: input.environmentId,
      credentials: input.credentials,
      method: "GET",
      path: "/v5/account/wallet-balance",
      query: "accountType=UNIFIED",
      timeoutMs: 8_000,
    }),
    bybitPrivateRequest<AccountInfoResult>({
      environmentId: input.environmentId,
      credentials: input.credentials,
      method: "GET",
      path: "/v5/account/info",
      timeoutMs: 8_000,
    }),
  ]);
  if (!wallet.ok) {
    return { ok: false, error: wallet.error };
  }
  const snapshot = snapshotFromBybit({
    wallet: wallet.result,
    info: info.ok ? info.result : null,
  });
  if (!snapshot) {
    return { ok: false, error: "Bybit did not return a unified account." };
  }
  return { ok: true, snapshot };
}
