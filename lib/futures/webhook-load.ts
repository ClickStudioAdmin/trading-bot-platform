import { fromByteaParam, toByteaParam } from "@/lib/exchanges/connections";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateWebhookToken,
  hashWebhookToken,
  futuresWebhookPath,
} from "./webhook";
import { decryptWebhookToken, encryptWebhookToken } from "./webhook-secret";

export type FuturesWebhookSettings = {
  enabled: boolean;
  url: string | null;
};

export async function loadFuturesWebhookSettings(input: {
  accountId: string;
  origin: string;
}): Promise<FuturesWebhookSettings> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { enabled: false, url: null };
  }
  const { data, error } = await supabase
    .from("strategy_settings")
    .select("webhook_token_ciphertext, webhook_token_nonce")
    .eq("account_id", input.accountId)
    .eq("strategy_id", FUTURES_STRATEGY_ID)
    .maybeSingle();
  if (error || !data) {
    return { enabled: false, url: null };
  }
  const ciphertext = fromByteaParam(
    (data as { webhook_token_ciphertext?: unknown }).webhook_token_ciphertext,
  );
  const nonce = fromByteaParam(
    (data as { webhook_token_nonce?: unknown }).webhook_token_nonce,
  );
  if (!ciphertext || !nonce) {
    return { enabled: false, url: null };
  }
  const token = decryptWebhookToken(ciphertext, nonce);
  if (!token || !input.origin) {
    return { enabled: Boolean(token), url: null };
  }
  return {
    enabled: true,
    url: `${input.origin}${futuresWebhookPath(token)}`,
  };
}

export async function rotateFuturesWebhookToken(input: {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const token = generateWebhookToken();
  let sealed: ReturnType<typeof encryptWebhookToken>;
  try {
    sealed = encryptWebhookToken(token);
  } catch {
    return { ok: false, error: "Exchange credentials key is not configured." };
  }
  const now = new Date().toISOString();
  const { error } = await input.supabase.from("strategy_settings").upsert({
    user_id: input.userId,
    account_id: input.accountId,
    strategy_id: FUTURES_STRATEGY_ID,
    webhook_token_hash: hashWebhookToken(token),
    webhook_token_ciphertext: toByteaParam(sealed.ciphertext),
    webhook_token_nonce: toByteaParam(sealed.nonce),
    updated_at: now,
  });
  if (error) {
    return { ok: false, error: "Could not save the webhook URL." };
  }
  return { ok: true, token };
}

export async function disableFuturesWebhookToken(input: {
  supabase: SupabaseClient;
  accountId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await input.supabase
    .from("strategy_settings")
    .update({
      webhook_token_hash: null,
      webhook_token_ciphertext: null,
      webhook_token_nonce: null,
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", input.accountId)
    .eq("strategy_id", FUTURES_STRATEGY_ID);
  if (error) {
    return { ok: false, error: "Could not disable the webhook." };
  }
  return { ok: true };
}
