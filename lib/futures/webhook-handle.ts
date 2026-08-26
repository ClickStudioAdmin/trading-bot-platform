import { parseAccountMode } from "@/lib/accounts/model";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { runFuturesCommand } from "./command";
import { loadOpenFuturesOnSymbol } from "./list";
import {
  hashWebhookToken,
  isWebhookTokenShape,
  parseFuturesWebhook,
  parseWebhookJson,
  WEBHOOK_RULE_NAME,
  webhookTokensMatch,
} from "./webhook";

export type FuturesWebhookHttpResult = {
  status: number;
  body: Record<string, unknown>;
};

export async function handleFuturesWebhook(input: {
  token: string;
  rawBody: unknown;
}): Promise<FuturesWebhookHttpResult> {
  if (!isWebhookTokenShape(input.token)) {
    return unauthorized();
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { status: 503, body: { ok: false, error: "Auth is not configured." } };
  }

  const parsedJson = parseWebhookJson(input.rawBody);
  if (!parsedJson.ok) {
    return { status: 400, body: { ok: false, error: parsedJson.error } };
  }
  const parsed = parseFuturesWebhook(parsedJson.body);
  if (!parsed.ok) {
    return { status: 400, body: { ok: false, error: parsed.error } };
  }

  const hash = hashWebhookToken(input.token);
  const { data, error } = await supabase
    .from("strategy_settings")
    .select("account_id, user_id, webhook_token_hash")
    .eq("strategy_id", FUTURES_STRATEGY_ID)
    .eq("webhook_token_hash", hash)
    .maybeSingle();
  if (error || !data) {
    return unauthorized();
  }
  const storedHash = String(
    (data as { webhook_token_hash?: string }).webhook_token_hash ?? "",
  );
  if (!webhookTokensMatch(storedHash, hash)) {
    return unauthorized();
  }

  const accountId = String((data as { account_id: string }).account_id);
  const userId = String((data as { user_id: string }).user_id);
  const { data: account, error: accountError } = await supabase
    .from("trading_accounts")
    .select("id, user_id, mode")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();
  if (accountError || !account) {
    return unauthorized();
  }
  const mode = parseAccountMode((account as { mode?: unknown }).mode);

  if (parsed.parsed.kind === "arm") {
    await writeEventLog({
      scope: "strategy",
      event: `webhook.${parsed.parsed.verb}`,
      message: `Accepted ${parsed.parsed.verb}. No playbook on this book yet.`,
      userId,
      accountId,
      strategy: FUTURES_STRATEGY_ID,
      data: { verb: parsed.parsed.verb },
    });
    return {
      status: 200,
      body: {
        ok: true,
        accepted: true,
        playbook: false,
        verb: parsed.parsed.verb,
      },
    };
  }

  const order = parsed.parsed;
  let positionId: string | undefined;
  if (order.action === "flatten") {
    const resolved = await resolveClosePositionId({
      userId,
      accountId,
      symbol: order.symbol,
      closeSide: order.closeSide,
    });
    if (!resolved.ok) {
      return { status: 200, body: { ok: false, error: resolved.error } };
    }
    positionId = resolved.positionId;
  }

  const result = await runFuturesCommand({
    actor: { userId, accountId, mode },
    command: {
      kind: "place",
      action: order.action,
      symbol: order.symbol,
      orderType: order.orderType,
      positionId,
      size: order.size,
      sizeUnit: order.sizeUnit,
      limitPrice: order.limitPrice ?? undefined,
      idempotencyKey: order.idempotencyKey,
      source: "engine",
      ruleName: WEBHOOK_RULE_NAME,
    },
  });
  if (!result.ok) {
    await writeEventLog({
      level: "warning",
      scope: "trade",
      event: "webhook.order_failed",
      message: result.error,
      userId,
      accountId,
      strategy: FUTURES_STRATEGY_ID,
      data: { symbol: order.symbol, action: order.action },
    });
    return { status: 200, body: { ok: false, error: result.error } };
  }
  return {
    status: 200,
    body: {
      ok: true,
      flash: result.flash,
      replayed: result.replayed === true,
    },
  };
}

function unauthorized(): FuturesWebhookHttpResult {
  return { status: 401, body: { ok: false, error: "Unauthorized." } };
}

async function resolveClosePositionId(input: {
  userId: string;
  accountId: string;
  symbol: string;
  closeSide: "long" | "short" | null;
}): Promise<{ ok: true; positionId: string } | { ok: false; error: string }> {
  const opens = await loadOpenFuturesOnSymbol(input.symbol, {
    userId: input.userId,
    accountId: input.accountId,
  });
  const matches = input.closeSide
    ? opens.filter((row) => row.side === input.closeSide)
    : opens;
  if (matches.length === 0) {
    return { ok: false, error: "There is no open position to close." };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      error: "Both sides are open. Set side to long or short.",
    };
  }
  return { ok: true, positionId: matches[0].id };
}
