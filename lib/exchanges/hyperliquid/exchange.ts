import { agentAddressFromPrivateKey } from "./agent";
import { hyperliquidExchangeUrl, hyperliquidIsMainnet } from "./host";
import { nextActionNonce, signL1Action, type L1Action } from "./sign";

export type HyperliquidOrderAck = {
  oid: string;
  avgPx: number | null;
  sz: number | null;
  status: "filled" | "resting" | "error";
  error?: string;
};

export async function postHyperliquidAction(input: {
  environmentId: string;
  agentKey: string;
  action: L1Action | Record<string, unknown>;
}): Promise<{ ok: true; body: unknown } | { ok: false; error: string }> {
  const url = hyperliquidExchangeUrl(input.environmentId);
  if (!url) {
    return { ok: false, error: "Unknown Hyperliquid network." };
  }
  const agent = agentAddressFromPrivateKey(input.agentKey);
  if (!agent) {
    return { ok: false, error: "Agent private key is not a valid key." };
  }
  const nonce = nextActionNonce(agent);
  const signature = signL1Action({
    agentKey: input.agentKey,
    action: input.action,
    nonce,
    isMainnet: hyperliquidIsMainnet(input.environmentId),
  });
  if ("error" in signature) {
    return signature;
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: input.action,
        nonce,
        signature,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, error: "Could not reach Hyperliquid." };
  }
  if (!response.ok) {
    return { ok: false, error: "Could not reach Hyperliquid." };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: "Hyperliquid rejected that request." };
  }
  const status = String((body as { status?: unknown }).status ?? "");
  if (status !== "ok") {
    const responseBody = (body as { response?: unknown }).response;
    const message =
      typeof responseBody === "string"
        ? responseBody
        : "Hyperliquid rejected that request.";
    return { ok: false, error: message };
  }
  return { ok: true, body };
}

export function parseOrderStatuses(body: unknown): HyperliquidOrderAck[] {
  const response = (body as { response?: { data?: { statuses?: unknown[] } } })
    .response;
  const statuses = response?.data?.statuses;
  if (!Array.isArray(statuses)) {
    return [];
  }
  return statuses.map((row) => {
    if (typeof row === "string") {
      return { oid: "", avgPx: null, sz: null, status: "error", error: row };
    }
    if (row && typeof row === "object") {
      const record = row as Record<string, unknown>;
      if (typeof record.error === "string") {
        return {
          oid: "",
          avgPx: null,
          sz: null,
          status: "error",
          error: record.error,
        };
      }
      const filled = record.filled as
        | { oid?: number; avgPx?: string; totalSz?: string }
        | undefined;
      if (filled) {
        return {
          oid: String(filled.oid ?? ""),
          avgPx: Number(filled.avgPx) || null,
          sz: Number(filled.totalSz) || null,
          status: "filled",
        };
      }
      const resting = record.resting as { oid?: number } | undefined;
      if (resting) {
        return {
          oid: String(resting.oid ?? ""),
          avgPx: null,
          sz: null,
          status: "resting",
        };
      }
    }
    return {
      oid: "",
      avgPx: null,
      sz: null,
      status: "error",
      error: "Hyperliquid did not accept that order.",
    };
  });
}
