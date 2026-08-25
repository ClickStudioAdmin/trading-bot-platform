import { bybitSignPayload, hmacSha256Hex } from "./sign";
import { bybitRestHost } from "./universe";

const RECV_WINDOW = "5000";

type BybitBody<T> = {
  retCode: number;
  retMsg: string;
  result?: T;
};

export type BybitPrivateCreds = {
  apiKey: string;
  apiSecret: string;
};

export async function bybitPrivateRequest<T>(input: {
  environmentId: string;
  credentials: BybitPrivateCreds;
  method: "GET" | "POST";
  path: string;
  query?: string;
  body?: string;
  allowMissingResult?: boolean;
  timeoutMs?: number;
}): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  const apiKey = input.credentials.apiKey;
  const apiSecret = input.credentials.apiSecret;
  if (!apiKey || !apiSecret) {
    return { ok: false, error: "API key and secret are required." };
  }
  const timestamp = String(Date.now());
  const payload = bybitSignPayload({
    timestamp,
    apiKey,
    recvWindow: RECV_WINDOW,
    query: input.body ?? input.query ?? "",
  });
  const sign = hmacSha256Hex(apiSecret, payload);
  const url = `${bybitRestHost(input.environmentId)}${input.path}${
    input.query ? `?${input.query}` : ""
  }`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: input.method,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-BAPI-API-KEY": apiKey,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-SIGN": sign,
        "X-BAPI-RECV-WINDOW": RECV_WINDOW,
      },
      body: input.method === "POST" ? input.body : undefined,
      signal: AbortSignal.timeout(input.timeoutMs ?? 15_000),
    });
  } catch {
    return { ok: false, error: "Could not reach Bybit." };
  }

  if (!response.ok) {
    if (response.status === 403) {
      return {
        ok: false,
        error:
          "Bybit HTTP 403. Bybit blocks many US cloud IPs. Vercel functions must run in Sydney (syd1).",
      };
    }
    return { ok: false, error: `Bybit HTTP ${response.status}.` };
  }

  let body: BybitBody<T>;
  try {
    body = (await response.json()) as BybitBody<T>;
  } catch {
    return { ok: false, error: "Bybit rejected that request." };
  }
  if (body.retCode !== 0) {
    return {
      ok: false,
      error: `Bybit rejected that order${body.retMsg ? `: ${body.retMsg}` : "."}`,
    };
  }
  if (body.result === undefined) {
    if (input.allowMissingResult) {
      return { ok: true, result: {} as T };
    }
    return {
      ok: false,
      error: `Bybit rejected that order${body.retMsg ? `: ${body.retMsg}` : "."}`,
    };
  }
  return { ok: true, result: body.result };
}
