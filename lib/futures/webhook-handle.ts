import {
  deskAllowsOrderWebhooks,
  deskAllowsSignalWebhooks,
  parseAccountMode,
  parseDeskType,
} from "@/lib/accounts/model";
import { applyDcaVerb } from "@/lib/dca/run";
import { loadDcaPlaybook } from "@/lib/dca/store";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { fireWebhookAutomationEntries } from "./automation-tick";
import { runFuturesCommand } from "./command";
import { loadOpenFuturesOnSymbol } from "./list";
import {
  hashWebhookToken,
  isWebhookTokenShape,
  parseFuturesWebhook,
  parseWebhookJson,
  parseWebhookKind,
  WEBHOOK_RULE_NAME,
  webhookTokensMatch,
  type WebhookKind,
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
  const found = await lookupWebhookByHash(supabase, hash);
  if (!found) {
    return unauthorized();
  }
  if (!webhookTokensMatch(found.hash, hash)) {
    return unauthorized();
  }

  const accountId = found.accountId;
  const userId = found.userId;
  const ruleName = found.name;
  if (found.kind === "signal" && parsed.parsed.kind === "order") {
    return {
      status: 400,
      body: {
        ok: false,
        error:
          "This webhook is a Signal. Send arm, disarm, or close-playbook.",
      },
    };
  }
  if (found.kind === "order" && parsed.parsed.kind === "arm") {
    return {
      status: 400,
      body: {
        ok: false,
        error:
          "This webhook is a TradingView strategy. Send buy, sell, or close.",
      },
    };
  }
  const { data: account, error: accountError } = await supabase
    .from("trading_accounts")
    .select("id, user_id, mode, desk_type")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();
  if (accountError || !account) {
    return unauthorized();
  }
  const mode = parseAccountMode((account as { mode?: unknown }).mode);
  const deskType = parseDeskType((account as { desk_type?: unknown }).desk_type);
  if (deskType === "cash_and_carry") {
    return {
      status: 400,
      body: {
        ok: false,
        error: "This desk does not accept Futures webhooks.",
      },
    };
  }
  if (
    !deskAllowsSignalWebhooks(deskType) &&
    (found.kind === "signal" || parsed.parsed.kind === "arm")
  ) {
    return {
      status: 400,
      body: {
        ok: false,
        error:
          "This desk only accepts TradingView strategy orders. Send buy, sell, or close.",
      },
    };
  }
  if (
    !deskAllowsOrderWebhooks(deskType) &&
    (found.kind === "order" || parsed.parsed.kind === "order")
  ) {
    return {
      status: 400,
      body: {
        ok: false,
        error:
          "This desk only accepts Signal arm. The playbook owns clips.",
      },
    };
  }

  if (parsed.parsed.kind === "arm") {
    if (deskType === "dca") {
      const playbook = await loadDcaPlaybook(accountId);
      if (!playbook) {
        await writeEventLog({
          scope: "strategy",
          event: `webhook.${parsed.parsed.verb}`,
          message: "Signal accepted. Save a DCA playbook first.",
          userId,
          accountId,
          strategy: FUTURES_STRATEGY_ID,
          data: { verb: parsed.parsed.verb, webhook: found.name },
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
      const ran = await applyDcaVerb({
        playbook,
        mode,
        verb: parsed.parsed.verb,
      });
      await writeEventLog({
        scope: "strategy",
        event: `webhook.${parsed.parsed.verb}`,
        message: ran.ok ? ran.message : ran.error,
        userId,
        accountId,
        strategy: FUTURES_STRATEGY_ID,
        data: {
          verb: parsed.parsed.verb,
          webhook: found.name,
          playbookId: playbook.id,
        },
      });
      if (!ran.ok) {
        return { status: 200, body: { ok: false, error: ran.error } };
      }
      return {
        status: 200,
        body: {
          ok: true,
          accepted: true,
          playbook: true,
          verb: parsed.parsed.verb,
        },
      };
    }
    let fired = 0;
    if (parsed.parsed.verb === "arm" && found.id && deskType === "perps") {
      const entries = await fireWebhookAutomationEntries({
        webhookId: found.id,
        accountId,
        userId,
        mode,
      });
      fired = entries.fired;
    }
    await writeEventLog({
      scope: "strategy",
      event: `webhook.${parsed.parsed.verb}`,
      message:
        parsed.parsed.verb === "arm"
          ? fired > 0
            ? `Signal fired ${fired} automation ${fired === 1 ? "rule" : "rules"}.`
            : "Signal accepted. No automation uses this webhook yet."
          : `Accepted ${parsed.parsed.verb}.`,
      userId,
      accountId,
      strategy: FUTURES_STRATEGY_ID,
      data: { verb: parsed.parsed.verb, fired, webhook: found.name },
    });
    return {
      status: 200,
      body: {
        ok: true,
        accepted: true,
        playbook: false,
        verb: parsed.parsed.verb,
        fired,
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
      source: "webhook",
      ruleName,
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
      data: { symbol: order.symbol, action: order.action, webhook: ruleName },
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

async function lookupWebhookByHash(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  hash: string,
): Promise<{
  accountId: string;
  userId: string;
  id: string | null;
  hash: string;
  name: string;
  kind: WebhookKind;
} | null> {
  const named = await supabase
    .from("futures_webhooks")
    .select("id, account_id, user_id, webhook_token_hash, name, kind")
    .eq("webhook_token_hash", hash)
    .maybeSingle();
  if (!named.error && named.data) {
    const kind = parseWebhookKind((named.data as { kind?: unknown }).kind);
    return {
      id: String((named.data as { id: string }).id),
      accountId: String((named.data as { account_id: string }).account_id),
      userId: String((named.data as { user_id: string }).user_id),
      hash: String(
        (named.data as { webhook_token_hash?: string }).webhook_token_hash ?? "",
      ),
      name:
        String((named.data as { name?: string }).name ?? "").trim() ||
        WEBHOOK_RULE_NAME,
      kind: kind.ok ? kind.kind : "order",
    };
  }
  const legacy = await supabase
    .from("strategy_settings")
    .select("account_id, user_id, webhook_token_hash")
    .eq("strategy_id", FUTURES_STRATEGY_ID)
    .eq("webhook_token_hash", hash)
    .maybeSingle();
  if (legacy.error || !legacy.data) {
    return null;
  }
  return {
    id: null,
    accountId: String((legacy.data as { account_id: string }).account_id),
    userId: String((legacy.data as { user_id: string }).user_id),
    hash: String(
      (legacy.data as { webhook_token_hash?: string }).webhook_token_hash ?? "",
    ),
    name: WEBHOOK_RULE_NAME,
    kind: "order",
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
