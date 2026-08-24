import { judgeBybitApiKey, type BybitApiKeyInfo } from "./permissions";
import { bybitSignPayload, hmacSha256Hex } from "./sign";
import { bybitRestHost } from "./universe";

const RECV_WINDOW = "5000";

type BybitBody<T> = {
  retCode: number;
  retMsg: string;
  result?: T;
};

export async function verifyBybitCredentials(
  environmentId: string,
  credentials: Record<string, string>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = credentials.apiKey ?? "";
  const apiSecret = credentials.apiSecret ?? "";
  if (!apiKey || !apiSecret) {
    return { ok: false, error: "API key and secret are required." };
  }

  const timestamp = String(Date.now());
  const payload = bybitSignPayload({
    timestamp,
    apiKey,
    recvWindow: RECV_WINDOW,
    query: "",
  });
  const sign = hmacSha256Hex(apiSecret, payload);
  const url = `${bybitRestHost(environmentId)}/v5/user/query-api`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "X-BAPI-API-KEY": apiKey,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-SIGN": sign,
        "X-BAPI-RECV-WINDOW": RECV_WINDOW,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, error: "Could not reach Bybit to verify that key." };
  }

  if (!response.ok) {
    if (response.status === 403) {
      return {
        ok: false,
        error:
          "Bybit HTTP 403. Bybit blocks many US cloud IPs. Vercel functions must run in Sydney (syd1).",
      };
    }
    return { ok: false, error: `Bybit HTTP ${response.status} while verifying.` };
  }

  let body: BybitBody<BybitApiKeyInfo>;
  try {
    body = (await response.json()) as BybitBody<BybitApiKeyInfo>;
  } catch {
    return { ok: false, error: "Bybit rejected that key." };
  }
  if (body.retCode !== 0 || !body.result) {
    return {
      ok: false,
      error: formatBybitVerifyReject(body.retCode, body.retMsg ?? ""),
    };
  }
  return judgeBybitApiKey(body.result);
}

export function formatBybitVerifyReject(retCode: number, retMsg: string): string {
  if (retCode === 10003 || /api key is invalid/i.test(retMsg)) {
    return "Bybit rejected that key. Demo keys need Environment Demo; production keys need Live.";
  }
  if (retCode === 10004 || /error sign/i.test(retMsg)) {
    return "Bybit rejected that key. Check the API secret.";
  }
  if (retCode === 10010 || /unmatched ip/i.test(retMsg)) {
    return "Bybit rejected that key. This server IP is not on the key's allow list.";
  }
  return `Bybit rejected that key${retMsg ? `: ${retMsg}` : "."}`;
}
