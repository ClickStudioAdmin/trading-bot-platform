import { BYBIT_PUBLIC_REST, type BybitInstrument } from "./universe";

type InstrumentsResponse = {
  retCode: number;
  retMsg: string;
  result?: {
    list?: BybitInstrument[];
    nextPageCursor?: string;
  };
};

async function fetchInstrumentPage(
  category: "linear" | "spot",
  cursor?: string,
): Promise<InstrumentsResponse> {
  const url = new URL(`${BYBIT_PUBLIC_REST}/v5/market/instruments-info`);
  url.searchParams.set("category", category);
  url.searchParams.set("limit", "1000");
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "Bybit instruments HTTP 403. Bybit blocks many US cloud IPs. This app’s Vercel functions must run in Sydney (syd1), not iad1.",
      );
    }
    throw new Error(`Bybit instruments HTTP ${response.status}`);
  }

  return (await response.json()) as InstrumentsResponse;
}

export async function fetchBybitInstruments(
  category: "linear" | "spot",
): Promise<BybitInstrument[]> {
  const rows: BybitInstrument[] = [];
  let cursor: string | undefined;

  do {
    const body = await fetchInstrumentPage(category, cursor);
    if (body.retCode !== 0) {
      throw new Error(`Bybit instruments: ${body.retMsg || body.retCode}`);
    }
    rows.push(...(body.result?.list ?? []));
    cursor = body.result?.nextPageCursor || undefined;
  } while (cursor);

  return rows;
}
