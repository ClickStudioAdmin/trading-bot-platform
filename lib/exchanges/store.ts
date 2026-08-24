import {
  parseExchangeConnectionRow,
  toByteaParam,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import { createServiceClient } from "@/lib/supabase/admin";

const LIST_COLUMNS =
  "id, account_id, user_id, venue, environment, label, key_fingerprint, status, verified_at, created_at";

export async function listExchangeConnections(
  userId: string,
  accountId: string,
): Promise<ExchangeConnection[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("exchange_connections")
    .select(LIST_COLUMNS)
    .eq("user_id", userId)
    .eq("account_id", accountId)
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
  accountId: string;
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
      account_id: input.accountId,
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
          "That exchange is already connected for this environment. Remove it first to replace the key.",
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

export async function deleteExchangeConnection(input: {
  userId: string;
  accountId: string;
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
    .eq("user_id", input.userId)
    .eq("account_id", input.accountId);
  return { error: error?.message ?? null };
}
