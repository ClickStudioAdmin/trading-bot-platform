import { createServiceClient } from "@/lib/supabase/admin";
import { BYBIT_AGREEMENT_NOTE, isBybitAgreementReject } from "./agreement";

function agreementSymbol(symbol: string): string | null {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,32}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

export async function listAgreementSymbols(
  connectionId: string | null | undefined,
): Promise<string[]> {
  const id = String(connectionId ?? "").trim();
  if (!id) {
    return [];
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("exchange_agreement_blocks")
    .select("symbol")
    .eq("connection_id", id);
  if (error || !data) {
    return [];
  }
  return data
    .map((row) => agreementSymbol(String(row.symbol ?? "")))
    .filter((symbol): symbol is string => Boolean(symbol));
}

export async function agreementSymbolBlocked(
  connectionId: string,
  symbol: string,
): Promise<boolean> {
  const normalized = agreementSymbol(symbol);
  const id = connectionId.trim();
  if (!id || !normalized) {
    return false;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return false;
  }
  const { data, error } = await supabase
    .from("exchange_agreement_blocks")
    .select("symbol")
    .eq("connection_id", id)
    .eq("symbol", normalized)
    .maybeSingle();
  if (error || !data) {
    return false;
  }
  return true;
}

export async function recordAgreementBlock(input: {
  connectionId: string;
  symbol: string;
}): Promise<void> {
  const symbol = agreementSymbol(input.symbol);
  const connectionId = input.connectionId.trim();
  if (!connectionId || !symbol) {
    return;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  await supabase.from("exchange_agreement_blocks").upsert(
    { connection_id: connectionId, symbol },
    { onConflict: "connection_id,symbol", ignoreDuplicates: true },
  );
}

export async function clearAgreementBlock(input: {
  connectionId: string | null;
  symbol: string;
}): Promise<void> {
  const symbol = agreementSymbol(input.symbol);
  const connectionId = String(input.connectionId ?? "").trim();
  if (!connectionId || !symbol) {
    return;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  await supabase
    .from("exchange_agreement_blocks")
    .delete()
    .eq("connection_id", connectionId)
    .eq("symbol", symbol);
}

export async function bybitOpeningAgreementError(input: {
  venue: string;
  connectionId: string;
  symbol: string;
  reduceOnly?: boolean;
}): Promise<string | null> {
  if (input.venue !== "bybit" || input.reduceOnly) {
    return null;
  }
  const blocked = await agreementSymbolBlocked(input.connectionId, input.symbol);
  return blocked ? BYBIT_AGREEMENT_NOTE : null;
}

export async function rememberBybitAgreementReject(input: {
  venue: string;
  connectionId: string;
  symbol: string;
  reduceOnly?: boolean;
  error: string;
}): Promise<void> {
  if (input.venue !== "bybit" || input.reduceOnly) {
    return;
  }
  if (!isBybitAgreementReject(input.error)) {
    return;
  }
  await recordAgreementBlock({
    connectionId: input.connectionId,
    symbol: input.symbol,
  });
}
