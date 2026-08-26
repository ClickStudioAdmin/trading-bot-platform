import type { TradingAccountMode } from "@/lib/accounts/model";
import type { FuturesTpsl } from "./tpsl";
import type { FuturesTrailing } from "./trailing";
import type { SupabaseClient } from "@supabase/supabase-js";

export const FUTURES_IDEMPOTENCY_MAX = 36;

export type FuturesCommandActor = {
  userId: string;
  accountId: string;
  mode: TradingAccountMode;
};

export type FuturesCommandFlash =
  | "opened"
  | "added"
  | "closed"
  | "working"
  | "live-opened"
  | "live-added"
  | "live-closed"
  | "live-working"
  | "tpsl"
  | "live-tpsl"
  | "trailing"
  | "live-trailing"
  | "cancelled"
  | "amended"
  | "live-amended";

export type FuturesCommandResult =
  | { ok: true; flash: FuturesCommandFlash; replayed?: boolean }
  | { ok: false; error: string };

export type FuturesPlaceCommand = {
  kind: "place";
  action: unknown;
  symbol: unknown;
  orderType?: unknown;
  positionId?: unknown;
  size?: unknown;
  sizeUnit?: unknown;
  limitPrice?: unknown;
  idempotencyKey?: unknown;
  tpsl?: FuturesTpsl | null;
  trailing?: FuturesTrailing | null;
  tpslForm?: FormData;
  trailingForm?: FormData;
};

export type FuturesCommand =
  | FuturesPlaceCommand
  | {
      kind: "set-tpsl";
      positionId: unknown;
      symbol: unknown;
      form: FormData;
      tpsl?: FuturesTpsl;
      idempotencyKey?: unknown;
    }
  | {
      kind: "set-trailing";
      positionId: unknown;
      symbol: unknown;
      form: FormData;
      trailing?: FuturesTrailing | null;
      idempotencyKey?: unknown;
    }
  | {
      kind: "cancel-working";
      workingId: unknown;
      idempotencyKey?: unknown;
    }
  | {
      kind: "amend-working";
      workingId: unknown;
      qty: unknown;
      limitPrice: unknown;
      idempotencyKey?: unknown;
    };

export function parseIdempotencyKey(
  raw: unknown,
): { ok: true; key: string | null } | { ok: false; error: string } {
  if (raw == null) {
    return { ok: true, key: null };
  }
  const key = String(raw).trim();
  if (key === "") {
    return { ok: true, key: null };
  }
  if (key.length > FUTURES_IDEMPOTENCY_MAX) {
    return {
      ok: false,
      error: `Idempotency key must be ${FUTURES_IDEMPOTENCY_MAX} characters or fewer.`,
    };
  }
  return { ok: true, key };
}

export async function loadCommandReceipt(
  supabase: SupabaseClient,
  accountId: string,
  key: string,
): Promise<{ flash: FuturesCommandFlash } | null> {
  const { data, error } = await supabase
    .from("futures_command_receipts")
    .select("flash")
    .eq("account_id", accountId)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return { flash: data.flash as FuturesCommandFlash };
}

export async function saveCommandReceipt(input: {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  key: string;
  flash: FuturesCommandFlash;
  workingId?: string | null;
  positionId?: string | null;
}): Promise<void> {
  await input.supabase.from("futures_command_receipts").insert({
    user_id: input.userId,
    account_id: input.accountId,
    idempotency_key: input.key,
    flash: input.flash,
    working_id: input.workingId ?? null,
    position_id: input.positionId ?? null,
  });
}

export async function replayOrNull(input: {
  supabase: SupabaseClient;
  accountId: string;
  key: string | null;
  liveBook?: boolean;
}): Promise<FuturesCommandResult | null> {
  if (!input.key) {
    return null;
  }
  const receipt = await loadCommandReceipt(
    input.supabase,
    input.accountId,
    input.key,
  );
  if (receipt) {
    return { ok: true, flash: receipt.flash, replayed: true };
  }
  const { data: working } = await input.supabase
    .from("futures_working_orders")
    .select("status, reduce_only")
    .eq("account_id", input.accountId)
    .eq("idempotency_key", input.key)
    .maybeSingle();
  if (working) {
    const live = Boolean(input.liveBook);
    const open = String(working.status) === "open";
    const close = Boolean(working.reduce_only);
    const flash: FuturesCommandFlash = open
      ? live
        ? "live-working"
        : "working"
      : close
        ? live
          ? "live-closed"
          : "closed"
        : live
          ? "live-opened"
          : "opened";
    return { ok: true, flash, replayed: true };
  }
  const { data: order } = await input.supabase
    .from("futures_orders")
    .select("action")
    .eq("account_id", input.accountId)
    .eq("idempotency_key", input.key)
    .maybeSingle();
  if (order) {
    const live = Boolean(input.liveBook);
    const flatten = String(order.action) === "flatten";
    const flash: FuturesCommandFlash = flatten
      ? live
        ? "live-closed"
        : "closed"
      : live
        ? "live-opened"
        : "opened";
    return { ok: true, flash, replayed: true };
  }
  return null;
}

export { runFuturesCommand } from "./run-command";

