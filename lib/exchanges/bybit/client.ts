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

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
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
