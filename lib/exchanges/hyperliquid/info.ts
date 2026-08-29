import { hyperliquidInfoUrl } from "./host";
import { hyperliquidCoin } from "./wire";

export type HyperliquidAsset = {
  coin: string;
  index: number;
  szDecimals: number;
};

export type HyperliquidTicker = {
  coin: string;
  mid: number;
};

export type HyperliquidCandle = {
  timeMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type HyperliquidUserState = {
  accountValue: number | null;
  withdrawable: number | null;
  totalMarginUsed: number | null;
  positions: HyperliquidPosition[];
};

export type HyperliquidPosition = {
  coin: string;
  size: number;
  entryPx: number | null;
  leverage: number | null;
  liqPx: number | null;
};

const metaCache = new Map<string, { at: number; assets: HyperliquidAsset[] }>();
const META_MS = 60_000;

async function postInfo(environmentId: string, body: unknown): Promise<unknown> {
  const url = hyperliquidInfoUrl(environmentId);
  if (!url) {
    throw new Error("Unknown Hyperliquid network.");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error("Could not reach Hyperliquid.");
  }
  return res.json();
}

function asNumber(raw: unknown): number | null {
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function loadHyperliquidMeta(
  environmentId: string,
): Promise<HyperliquidAsset[]> {
  const cached = metaCache.get(environmentId);
  if (cached && Date.now() - cached.at < META_MS) {
    return cached.assets;
  }
  const raw = (await postInfo(environmentId, { type: "meta" })) as {
    universe?: Array<{ name?: string; szDecimals?: number }>;
  };
  const assets = (raw.universe ?? [])
    .map((row, index) => {
      const coin = String(row.name ?? "").trim();
      if (!coin) {
        return null;
      }
      return {
        coin,
        index,
        szDecimals:
          Number.isInteger(row.szDecimals) && Number(row.szDecimals) >= 0
            ? Number(row.szDecimals)
            : 0,
      };
    })
    .filter((row): row is HyperliquidAsset => row !== null);
  metaCache.set(environmentId, { at: Date.now(), assets });
  return assets;
}

export async function findHyperliquidAsset(
  environmentId: string,
  symbol: string,
): Promise<HyperliquidAsset | null> {
  const coin = hyperliquidCoin(symbol);
  const assets = await loadHyperliquidMeta(environmentId);
  return assets.find((row) => row.coin.toUpperCase() === coin) ?? null;
}

export async function loadHyperliquidMids(
  environmentId: string,
): Promise<HyperliquidTicker[]> {
  const raw = (await postInfo(environmentId, { type: "allMids" })) as Record<
    string,
    unknown
  >;
  const tickers: HyperliquidTicker[] = [];
  for (const [coin, mid] of Object.entries(raw)) {
    const value = asNumber(mid);
    if (value !== null && value > 0) {
      tickers.push({ coin, mid: value });
    }
  }
  return tickers;
}

export async function loadHyperliquidMid(
  environmentId: string,
  symbol: string,
): Promise<number | null> {
  const coin = hyperliquidCoin(symbol);
  const tickers = await loadHyperliquidMids(environmentId);
  return tickers.find((row) => row.coin.toUpperCase() === coin)?.mid ?? null;
}

export async function loadHyperliquidCandles(input: {
  environmentId: string;
  symbol: string;
  interval: string;
  startTimeMs: number;
  endTimeMs: number;
}): Promise<HyperliquidCandle[]> {
  const raw = (await postInfo(input.environmentId, {
    type: "candleSnapshot",
    req: {
      coin: hyperliquidCoin(input.symbol),
      interval: input.interval,
      startTime: input.startTimeMs,
      endTime: input.endTimeMs,
    },
  })) as Array<{ t?: number; o?: string; h?: string; l?: string; c?: string }>;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((row) => {
      const timeMs = asNumber(row.t);
      const open = asNumber(row.o);
      const high = asNumber(row.h);
      const low = asNumber(row.l);
      const close = asNumber(row.c);
      if (
        timeMs === null ||
        open === null ||
        high === null ||
        low === null ||
        close === null
      ) {
        return null;
      }
      return { timeMs, open, high, low, close };
    })
    .filter((row): row is HyperliquidCandle => row !== null);
}

export async function loadHyperliquidUserState(input: {
  environmentId: string;
  accountAddress: string;
}): Promise<HyperliquidUserState> {
  const raw = (await postInfo(input.environmentId, {
    type: "clearinghouseState",
    user: input.accountAddress,
  })) as {
    marginSummary?: { accountValue?: string; totalMarginUsed?: string };
    withdrawable?: string;
    assetPositions?: Array<{
      position?: {
        coin?: string;
        szi?: string;
        entryPx?: string;
        leverage?: { value?: string } | string;
        liquidationPx?: string;
      };
    }>;
  };
  const positions: HyperliquidPosition[] = [];
  for (const row of raw.assetPositions ?? []) {
    const coin = String(row.position?.coin ?? "").trim();
    const size = asNumber(row.position?.szi) ?? 0;
    if (!coin || size === 0) {
      continue;
    }
    const leverageRaw = row.position?.leverage;
    const leverage =
      typeof leverageRaw === "object"
        ? asNumber(leverageRaw?.value)
        : asNumber(leverageRaw);
    positions.push({
      coin,
      size,
      entryPx: asNumber(row.position?.entryPx),
      leverage,
      liqPx: asNumber(row.position?.liquidationPx),
    });
  }
  return {
    accountValue: asNumber(raw.marginSummary?.accountValue),
    withdrawable: asNumber(raw.withdrawable),
    totalMarginUsed: asNumber(raw.marginSummary?.totalMarginUsed),
    positions,
  };
}

export type HyperliquidOpenOrder = {
  oid: number;
  coin: string;
  side: "B" | "A";
  sz: number;
  limitPx: number;
  cloid: string | null;
  reduceOnly: boolean;
  isTrigger: boolean;
  triggerPx: number | null;
  tpsl: "tp" | "sl" | null;
  orderType: string;
};

export function parseHyperliquidOpenOrder(
  raw: unknown,
): HyperliquidOpenOrder | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as {
    oid?: unknown;
    coin?: unknown;
    side?: unknown;
    sz?: unknown;
    limitPx?: unknown;
    cloid?: unknown;
    reduceOnly?: unknown;
    isTrigger?: unknown;
    triggerPx?: unknown;
    tpsl?: unknown;
    orderType?: unknown;
  };
  const oid = asNumber(row.oid);
  const coin = String(row.coin ?? "").trim();
  const sz = asNumber(row.sz);
  const triggerPx = asNumber(row.triggerPx);
  const limitPx = asNumber(row.limitPx) ?? triggerPx;
  if (oid === null || !coin || sz === null || limitPx === null) {
    return null;
  }
  const tpslRaw = String(row.tpsl ?? "").trim().toLowerCase();
  return {
    oid,
    coin,
    side: row.side === "B" ? "B" : "A",
    sz,
    limitPx,
    cloid: row.cloid ? String(row.cloid) : null,
    reduceOnly: Boolean(row.reduceOnly) || Boolean(row.isTrigger),
    isTrigger: Boolean(row.isTrigger) || tpslRaw === "tp" || tpslRaw === "sl",
    triggerPx,
    tpsl: tpslRaw === "tp" || tpslRaw === "sl" ? tpslRaw : null,
    orderType: String(row.orderType ?? ""),
  };
}

export async function loadHyperliquidOpenOrders(input: {
  environmentId: string;
  accountAddress: string;
}): Promise<HyperliquidOpenOrder[]> {
  const raw = await postInfo(input.environmentId, {
    type: "frontendOpenOrders",
    user: input.accountAddress,
  });
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((row) => parseHyperliquidOpenOrder(row))
    .filter((row): row is HyperliquidOpenOrder => row !== null);
}

export type HyperliquidOrderStatus = {
  status: string;
  oid: number;
  sz: number;
  filledSz: number;
  avgPx: number | null;
};

export function parseHyperliquidOrderStatus(
  raw: unknown,
): HyperliquidOrderStatus | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as {
    status?: unknown;
    order?: {
      status?: unknown;
      order?: Record<string, unknown>;
      oid?: unknown;
      sz?: unknown;
      origSz?: unknown;
      avgPx?: unknown;
    };
  };
  const wrapper = String(row.status ?? "").trim().toLowerCase();
  if (wrapper === "unknownoid" || wrapper === "unknown") {
    return null;
  }
  const nested = row.order?.order;
  const order =
    nested && typeof nested === "object"
      ? nested
      : row.order && typeof row.order === "object"
        ? row.order
        : null;
  const oid = asNumber(order?.oid);
  if (oid === null) {
    return null;
  }
  const orig = asNumber(order?.origSz) ?? asNumber(order?.sz) ?? 0;
  const remaining = asNumber(order?.sz) ?? 0;
  const statusRaw = row.order?.status ?? (wrapper !== "order" ? row.status : "");
  const status = String(statusRaw ?? "").trim() || "open";
  const filledFromDiff = Math.max(0, orig - remaining);
  const filled =
    status.toLowerCase() === "filled" && filledFromDiff <= 1e-12 && orig > 0
      ? orig
      : filledFromDiff;
  return {
    status,
    oid,
    sz: orig,
    filledSz: filled,
    avgPx: asNumber(order?.avgPx),
  };
}

export async function loadHyperliquidOrderStatus(input: {
  environmentId: string;
  accountAddress: string;
  oid: number;
}): Promise<HyperliquidOrderStatus | null> {
  const raw = await postInfo(input.environmentId, {
    type: "orderStatus",
    user: input.accountAddress,
    oid: input.oid,
  });
  return parseHyperliquidOrderStatus(raw);
}
