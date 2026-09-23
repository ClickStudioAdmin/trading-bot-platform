import { createServiceClient } from "@/lib/supabase/admin";
import { loadPerpInstrument, loadUsdtLinearPerps } from "@/lib/exchanges/bybit/perp";
import {
  BYBIT_AGREEMENT_NOTE,
  bybitAgreementKind,
  isBybitAgreementReject,
  perpNeedsBybitAgreement,
  symbolNeedsBybitAgreement,
  type BybitAgreementGate,
  type BybitAgreementKind,
  CLOSED_AGREEMENT_GATE,
} from "./agreement";

function agreementSymbol(symbol: string): string | null {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,32}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function agreementKind(value: string): BybitAgreementKind | null {
  return value === "tradfi" || value === "oil" ? value : null;
}

async function siblingConnectionIds(
  connectionId: string | null | undefined,
): Promise<string[]> {
  const id = String(connectionId ?? "").trim();
  if (!id) {
    return [];
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return [id];
  }
  const { data: row, error } = await supabase
    .from("exchange_connections")
    .select("id, user_id, venue, environment")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) {
    return [id];
  }
  const { data: siblings } = await supabase
    .from("exchange_connections")
    .select("id")
    .eq("user_id", row.user_id)
    .eq("venue", row.venue)
    .eq("environment", row.environment);
  const ids = (siblings ?? [])
    .map((item) => String(item.id ?? "").trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : [id];
}

export async function loadBybitAgreementGate(input: {
  connectionId: string | null | undefined;
  live: boolean;
}): Promise<BybitAgreementGate> {
  if (!input.live) {
    return CLOSED_AGREEMENT_GATE;
  }
  const ids = await siblingConnectionIds(input.connectionId);
  if (ids.length === 0) {
    return { symbols: [], cleared: [], live: true };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { symbols: [], cleared: [], live: true };
  }
  const [blocks, clears] = await Promise.all([
    supabase
      .from("exchange_agreement_blocks")
      .select("symbol")
      .in("connection_id", ids),
    supabase
      .from("exchange_agreement_clears")
      .select("kind")
      .in("connection_id", ids),
  ]);
  const symbols = [
    ...new Set(
      (blocks.data ?? [])
        .map((row) => agreementSymbol(String(row.symbol ?? "")))
        .filter((symbol): symbol is string => Boolean(symbol)),
    ),
  ];
  const cleared = [
    ...new Set(
      (clears.error ? [] : (clears.data ?? []))
        .map((row) => agreementKind(String(row.kind ?? "")))
        .filter((kind): kind is BybitAgreementKind => Boolean(kind)),
    ),
  ];
  return { symbols, cleared, live: true };
}

export async function listAgreementSymbols(
  connectionId: string | null | undefined,
): Promise<string[]> {
  const gate = await loadBybitAgreementGate({
    connectionId,
    live: Boolean(String(connectionId ?? "").trim()),
  });
  return [...gate.symbols];
}

export async function agreementSymbolBlocked(
  connectionId: string,
  symbol: string,
): Promise<boolean> {
  const normalized = agreementSymbol(symbol);
  if (!normalized) {
    return false;
  }
  const ids = await siblingConnectionIds(connectionId);
  if (ids.length === 0) {
    return false;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return false;
  }
  const { data, error } = await supabase
    .from("exchange_agreement_blocks")
    .select("symbol")
    .in("connection_id", ids)
    .eq("symbol", normalized)
    .limit(1);
  if (error || !data || data.length === 0) {
    return false;
  }
  return true;
}

export async function recordAgreementBlock(input: {
  connectionId: string;
  symbol: string;
}): Promise<void> {
  const symbol = agreementSymbol(input.symbol);
  if (!symbol) {
    return;
  }
  const ids = await siblingConnectionIds(input.connectionId);
  const supabase = createServiceClient();
  if (!supabase || ids.length === 0) {
    return;
  }
  await supabase.from("exchange_agreement_blocks").upsert(
    ids.map((connectionId) => ({ connection_id: connectionId, symbol })),
    { onConflict: "connection_id,symbol", ignoreDuplicates: true },
  );
}

export async function clearAgreementBlock(input: {
  connectionId: string | null;
  symbol: string;
}): Promise<void> {
  const symbol = agreementSymbol(input.symbol);
  if (!symbol) {
    return;
  }
  const ids = await siblingConnectionIds(input.connectionId);
  const supabase = createServiceClient();
  if (!supabase || ids.length === 0) {
    return;
  }
  await supabase
    .from("exchange_agreement_blocks")
    .delete()
    .in("connection_id", ids)
    .eq("symbol", symbol);
}

async function writeAgreementClear(input: {
  connectionId: string | null;
  kind: BybitAgreementKind;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = await siblingConnectionIds(input.connectionId);
  const supabase = createServiceClient();
  if (!supabase || ids.length === 0) {
    return { ok: false, error: "Bind an exchange before enabling these contracts." };
  }
  const { error } = await supabase.from("exchange_agreement_clears").upsert(
    ids.map((connectionId) => ({ connection_id: connectionId, kind: input.kind })),
    { onConflict: "connection_id,kind", ignoreDuplicates: true },
  );
  if (error) {
    return { ok: false, error: "Could not enable those contracts." };
  }
  return { ok: true };
}

export async function recordAgreementClear(input: {
  connectionId: string | null;
  kind: BybitAgreementKind;
}): Promise<void> {
  await writeAgreementClear(input);
}

export async function revokeAgreementClear(input: {
  connectionId: string | null;
  kind: BybitAgreementKind;
}): Promise<void> {
  const ids = await siblingConnectionIds(input.connectionId);
  const supabase = createServiceClient();
  if (!supabase || ids.length === 0) {
    return;
  }
  await supabase
    .from("exchange_agreement_clears")
    .delete()
    .in("connection_id", ids)
    .eq("kind", input.kind);
}

export async function enableBybitAgreementChoice(input: {
  connectionId: string | null;
  kind?: BybitAgreementKind | null;
  symbol?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const symbol = agreementSymbol(String(input.symbol ?? ""));
  let kind = input.kind ?? null;
  if (!kind && symbol) {
    const instrument = await loadPerpInstrument(symbol);
    kind = bybitAgreementKind({
      symbolType: instrument?.symbolType,
      baseCoin: instrument?.baseCoin,
    });
  }
  if (kind) {
    const written = await writeAgreementClear({
      connectionId: input.connectionId,
      kind,
    });
    if (!written.ok) {
      return written;
    }
    const symbols = (await loadUsdtLinearPerps())
      .filter((row) => bybitAgreementKind(row) === kind)
      .map((row) => row.symbol);
    const ids = await siblingConnectionIds(input.connectionId);
    const supabase = createServiceClient();
    if (supabase && ids.length > 0 && symbols.length > 0) {
      await supabase
        .from("exchange_agreement_blocks")
        .delete()
        .in("connection_id", ids)
        .in("symbol", symbols);
    }
    return { ok: true };
  }
  if (!symbol) {
    return { ok: false, error: "That contract was not found." };
  }
  await clearAgreementBlock({
    connectionId: input.connectionId,
    symbol,
  });
  return { ok: true };
}

export async function rejectUnsignedBybitSymbol(input: {
  live: boolean;
  venue: string;
  connectionId: string | null;
  symbol: string;
  previousSymbol?: string | null;
  active: boolean;
}): Promise<string | null> {
  if (!input.live || input.venue !== "bybit") {
    return null;
  }
  const gate = await loadBybitAgreementGate({
    connectionId: input.connectionId,
    live: true,
  });
  const instrument = await loadPerpInstrument(input.symbol);
  const pair = {
    symbol: input.symbol,
    symbolType: instrument?.symbolType,
    baseCoin: instrument?.baseCoin,
  };
  const selecting =
    !input.previousSymbol || input.previousSymbol.toUpperCase() !== input.symbol.toUpperCase();
  if (selecting && perpNeedsBybitAgreement(gate, pair)) {
    return BYBIT_AGREEMENT_NOTE;
  }
  if (
    !selecting &&
    input.active &&
    symbolNeedsBybitAgreement(gate.symbols, input.symbol) &&
    perpNeedsBybitAgreement(gate, pair)
  ) {
    return BYBIT_AGREEMENT_NOTE;
  }
  return null;
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
  const instrument = await loadPerpInstrument(input.symbol);
  const kind = bybitAgreementKind({
    symbolType: instrument?.symbolType,
    baseCoin: instrument?.baseCoin,
  });
  if (kind) {
    await revokeAgreementClear({
      connectionId: input.connectionId,
      kind,
    });
  }
}

export async function noteBybitAgreementTraded(input: {
  venue: string;
  connectionId: string;
  symbol: string;
  reduceOnly?: boolean;
}): Promise<void> {
  if (input.venue !== "bybit" || input.reduceOnly) {
    return;
  }
  const instrument = await loadPerpInstrument(input.symbol);
  const kind = bybitAgreementKind({
    symbolType: instrument?.symbolType,
    baseCoin: instrument?.baseCoin,
  });
  if (!kind) {
    return;
  }
  await recordAgreementClear({
    connectionId: input.connectionId,
    kind,
  });
}
