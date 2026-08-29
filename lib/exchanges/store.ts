import {
  fromByteaParam,
  parseExchangeConnectionRow,
  toByteaParam,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import { decryptCredentials } from "@/lib/exchanges/encrypt";
import { credentialsCompleteForVenue } from "@/lib/exchanges/venues";
import { createServiceClient } from "@/lib/supabase/admin";

const LIST_COLUMNS =
  "id, user_id, venue, environment, label, key_fingerprint, status, verified_at, created_at";

export async function listExchangeConnections(
  userId: string,
): Promise<ExchangeConnection[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("exchange_connections")
    .select(LIST_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error || !data) {
    return [];
  }
  return data
    .map((row) => parseExchangeConnectionRow(row as Record<string, unknown>))
    .filter((row): row is ExchangeConnection => row !== null);
}

export async function insertExchangeConnection(input: {
  userId: string;
  venue: string;
  environment: string;
  label: string | null;
  fingerprint: string;
  ciphertext: Buffer;
  nonce: Buffer;
  verifiedAt: string;
}): Promise<{ id: string } | { error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { error: "Auth is not configured." };
  }
  const { data, error } = await supabase
    .from("exchange_connections")
    .insert({
      user_id: input.userId,
      venue: input.venue,
      environment: input.environment,
      label: input.label,
      key_fingerprint: input.fingerprint,
      credentials_ciphertext: toByteaParam(input.ciphertext),
      credentials_nonce: toByteaParam(input.nonce),
      status: "active",
      verified_at: input.verifiedAt,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "That key is already saved. Pick it on a desk, or add a different key.",
      };
    }
    return { error: error.message };
  }
  const id = String(data?.id ?? "");
  if (!id) {
    return { error: "Could not save that connection." };
  }
  return { id };
}

export async function getExchangeConnectionForUser(input: {
  userId: string;
  connectionId: string;
}): Promise<ExchangeConnection | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("exchange_connections")
    .select(LIST_COLUMNS)
    .eq("id", input.connectionId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return parseExchangeConnectionRow(data as Record<string, unknown>);
}

export async function updateExchangeConnectionCredentials(input: {
  userId: string;
  connectionId: string;
  fingerprint: string;
  ciphertext: Buffer;
  nonce: Buffer;
  verifiedAt: string;
}): Promise<{ error: string | null }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { error: "Auth is not configured." };
  }
  const { data, error } = await supabase
    .from("exchange_connections")
    .update({
      key_fingerprint: input.fingerprint,
      credentials_ciphertext: toByteaParam(input.ciphertext),
      credentials_nonce: toByteaParam(input.nonce),
      status: "active",
      verified_at: input.verifiedAt,
    })
    .eq("id", input.connectionId)
    .eq("user_id", input.userId)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "That key is already saved on another connection. Remove the other one first, or paste this same key again.",
      };
    }
    return { error: error.message };
  }
  if (!data?.id) {
    return { error: "Could not update that connection." };
  }
  return { error: null };
}

export async function deleteExchangeConnection(input: {
  userId: string;
  connectionId: string;
}): Promise<{ error: string | null }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { error: "Auth is not configured." };
  }
  const { error } = await supabase
    .from("exchange_connections")
    .delete()
    .eq("id", input.connectionId)
    .eq("user_id", input.userId);
  return { error: error?.message ?? null };
}

export type BoundConnectionSecrets = {
  id: string;
  venue: string;
  environment: string;
  credentials: Record<string, string>;
};

export async function loadBoundConnectionSecrets(input: {
  userId: string;
  connectionId: string;
}): Promise<{ ok: true; connection: BoundConnectionSecrets } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Auth is not configured." };
  }
  const { data, error } = await supabase
    .from("exchange_connections")
    .select(
      "id, venue, environment, status, credentials_ciphertext, credentials_nonce",
    )
    .eq("id", input.connectionId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "Connect an exchange in Desk Settings first." };
  }
  if (String(data.status ?? "") !== "active") {
    return { ok: false, error: "That exchange connection is not active." };
  }
  const ciphertext = fromByteaParam(data.credentials_ciphertext);
  const nonce = fromByteaParam(data.credentials_nonce);
  if (!ciphertext || !nonce) {
    return { ok: false, error: "Could not read those credentials." };
  }
  const credentials = decryptCredentials(ciphertext, nonce);
  if (!credentials) {
    return { ok: false, error: "Could not decrypt those credentials." };
  }
  if (!credentialsCompleteForVenue(String(data.venue), credentials)) {
    return { ok: false, error: "Those credentials do not match this exchange." };
  }
  return {
    ok: true,
    connection: {
      id: String(data.id),
      venue: String(data.venue),
      environment: String(data.environment),
      credentials,
    },
  };
}

export type ConnectionDeskBind = {
  connectionId: string;
  accountId: string;
  accountName: string;
  strategy: "cash_and_carry" | "futures";
};

export async function listConnectionDeskBinds(
  userId: string,
): Promise<ConnectionDeskBind[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const [{ data: accounts }, { data: carry }, { data: futures }] =
    await Promise.all([
      supabase
        .from("trading_accounts")
        .select("id, name")
        .eq("user_id", userId),
      supabase
        .from("paper_engine_settings")
        .select("account_id, exchange_connection_id")
        .eq("user_id", userId)
        .not("exchange_connection_id", "is", null),
      supabase
        .from("strategy_settings")
        .select("account_id, exchange_connection_id")
        .eq("user_id", userId)
        .eq("strategy_id", "futures")
        .not("exchange_connection_id", "is", null),
    ]);
  const names = new Map(
    (accounts ?? []).map((row) => [
      String((row as { id: string }).id),
      String((row as { name: string }).name).trim() || "Desk",
    ]),
  );
  const binds: ConnectionDeskBind[] = [];
  for (const row of carry ?? []) {
    const accountId = String((row as { account_id: string }).account_id);
    const connectionId = String(
      (row as { exchange_connection_id: string }).exchange_connection_id,
    );
    if (accountId && connectionId) {
      binds.push({
        connectionId,
        accountId,
        accountName: names.get(accountId) ?? "Desk",
        strategy: "cash_and_carry",
      });
    }
  }
  for (const row of futures ?? []) {
    const accountId = String((row as { account_id: string }).account_id);
    const connectionId = String(
      (row as { exchange_connection_id: string }).exchange_connection_id,
    );
    if (accountId && connectionId) {
      binds.push({
        connectionId,
        accountId,
        accountName: names.get(accountId) ?? "Desk",
        strategy: "futures",
      });
    }
  }
  return binds;
}
