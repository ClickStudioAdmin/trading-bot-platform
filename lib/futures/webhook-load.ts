import { fromByteaParam, toByteaParam } from "@/lib/exchanges/connections";
import { createServiceClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateWebhookToken,
  hashWebhookToken,
  futuresWebhookPath,
  parseWebhookKind,
  parseWebhookName,
  webhookNameTakenAmong,
  WEBHOOK_MAX_PER_BOOK,
  WEBHOOK_NAME_IN_USE,
  type WebhookKind,
} from "./webhook";
import { decryptWebhookToken, encryptWebhookToken } from "./webhook-secret";

export type FuturesWebhookRow = {
  id: string;
  name: string;
  kind: WebhookKind;
  url: string | null;
};

type StoredWebhook = {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  kind: string;
  webhook_token_hash: string;
  webhook_token_ciphertext: unknown;
  webhook_token_nonce: unknown;
};

export async function listFuturesWebhooks(input: {
  accountId: string;
  origin: string;
}): Promise<FuturesWebhookRow[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("futures_webhooks")
    .select(
      "id, name, kind, webhook_token_ciphertext, webhook_token_nonce",
    )
    .eq("account_id", input.accountId)
    .order("created_at", { ascending: true });
  if (error || !data) {
    return [];
  }
  return data.map((row) => {
    const kind = parseWebhookKind((row as { kind?: unknown }).kind);
    const ciphertext = fromByteaParam(
      (row as { webhook_token_ciphertext?: unknown }).webhook_token_ciphertext,
    );
    const nonce = fromByteaParam(
      (row as { webhook_token_nonce?: unknown }).webhook_token_nonce,
    );
    const token =
      ciphertext && nonce ? decryptWebhookToken(ciphertext, nonce) : null;
    return {
      id: String((row as { id: string }).id),
      name: String((row as { name?: string }).name ?? "").trim() || "TradingView",
      kind: kind.ok ? kind.kind : "order",
      url:
        token && input.origin
          ? `${input.origin}${futuresWebhookPath(token)}`
          : null,
    };
  });
}

export async function createFuturesWebhook(input: {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  name: unknown;
  kind: unknown;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const name = parseWebhookName(input.name);
  if (!name.ok) {
    return name;
  }
  const kind = parseWebhookKind(input.kind);
  if (!kind.ok) {
    return kind;
  }
  const clash = await webhookNameInUse({
    supabase: input.supabase,
    accountId: input.accountId,
    name: name.name,
  });
  if (clash) {
    return { ok: false, error: WEBHOOK_NAME_IN_USE };
  }
  const { count } = await input.supabase
    .from("futures_webhooks")
    .select("id", { count: "exact", head: true })
    .eq("account_id", input.accountId);
  if ((count ?? 0) >= WEBHOOK_MAX_PER_BOOK) {
    return {
      ok: false,
      error: `This book can hold ${WEBHOOK_MAX_PER_BOOK} webhooks.`,
    };
  }
  const minted = mintWebhookToken();
  if (!minted.ok) {
    return minted;
  }
  const { error } = await input.supabase.from("futures_webhooks").insert({
    user_id: input.userId,
    account_id: input.accountId,
    name: name.name,
    kind: kind.kind,
    webhook_token_hash: minted.hash,
    webhook_token_ciphertext: toByteaParam(minted.ciphertext),
    webhook_token_nonce: toByteaParam(minted.nonce),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: WEBHOOK_NAME_IN_USE };
    }
    return { ok: false, error: "Could not save the webhook URL." };
  }
  return { ok: true, token: minted.token };
}

export async function renameFuturesWebhook(input: {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  webhookId: string;
  name: unknown;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = parseWebhookName(input.name);
  if (!name.ok) {
    return name;
  }
  const clash = await webhookNameInUse({
    supabase: input.supabase,
    accountId: input.accountId,
    name: name.name,
    exceptId: input.webhookId,
  });
  if (clash) {
    return { ok: false, error: WEBHOOK_NAME_IN_USE };
  }
  const { data, error } = await input.supabase
    .from("futures_webhooks")
    .update({
      name: name.name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.webhookId)
    .eq("account_id", input.accountId)
    .eq("user_id", input.userId)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: WEBHOOK_NAME_IN_USE };
    }
    return { ok: false, error: "Could not rename that webhook." };
  }
  if (!data) {
    return { ok: false, error: "Could not rename that webhook." };
  }
  return { ok: true };
}

export async function rotateFuturesWebhookToken(input: {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  webhookId: string;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const minted = mintWebhookToken();
  if (!minted.ok) {
    return minted;
  }
  const { data, error } = await input.supabase
    .from("futures_webhooks")
    .update({
      webhook_token_hash: minted.hash,
      webhook_token_ciphertext: toByteaParam(minted.ciphertext),
      webhook_token_nonce: toByteaParam(minted.nonce),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.webhookId)
    .eq("account_id", input.accountId)
    .eq("user_id", input.userId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "Could not rotate that webhook." };
  }
  return { ok: true, token: minted.token };
}

export async function deleteFuturesWebhook(input: {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  webhookId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await input.supabase
    .from("futures_webhooks")
    .delete()
    .eq("id", input.webhookId)
    .eq("account_id", input.accountId)
    .eq("user_id", input.userId);
  if (error) {
    return { ok: false, error: "Could not delete that webhook." };
  }
  return { ok: true };
}

export async function loadWebhookTokenForTest(input: {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  webhookId: string;
}): Promise<
  | { ok: true; token: string; name: string; kind: WebhookKind }
  | { ok: false; error: string }
> {
  const { data, error } = await input.supabase
    .from("futures_webhooks")
    .select(
      "name, kind, webhook_token_ciphertext, webhook_token_nonce",
    )
    .eq("id", input.webhookId)
    .eq("account_id", input.accountId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "Pick a webhook on this book." };
  }
  const ciphertext = fromByteaParam(
    (data as StoredWebhook).webhook_token_ciphertext,
  );
  const nonce = fromByteaParam((data as StoredWebhook).webhook_token_nonce);
  const token =
    ciphertext && nonce ? decryptWebhookToken(ciphertext, nonce) : null;
  if (!token) {
    return { ok: false, error: "Could not read that webhook token." };
  }
  const kind = parseWebhookKind((data as StoredWebhook).kind);
  return {
    ok: true,
    token,
    name:
      String((data as StoredWebhook).name ?? "").trim() || "TradingView",
    kind: kind.ok ? kind.kind : "order",
  };
}

async function webhookNameInUse(input: {
  supabase: SupabaseClient;
  accountId: string;
  name: string;
  exceptId?: string;
}): Promise<boolean> {
  const { data, error } = await input.supabase
    .from("futures_webhooks")
    .select("id, name")
    .eq("account_id", input.accountId);
  if (error || !data) {
    return false;
  }
  return webhookNameTakenAmong(
    data.map((row) => ({
      id: String((row as { id: string }).id),
      name: String((row as { name?: string }).name ?? ""),
    })),
    input.name,
    input.exceptId,
  );
}

function mintWebhookToken():
  | {
      ok: true;
      token: string;
      hash: string;
      ciphertext: Buffer;
      nonce: Buffer;
    }
  | { ok: false; error: string } {
  const token = generateWebhookToken();
  try {
    const sealed = encryptWebhookToken(token);
    return {
      ok: true,
      token,
      hash: hashWebhookToken(token),
      ciphertext: sealed.ciphertext,
      nonce: sealed.nonce,
    };
  } catch {
    return { ok: false, error: "Exchange credentials key is not configured." };
  }
}

