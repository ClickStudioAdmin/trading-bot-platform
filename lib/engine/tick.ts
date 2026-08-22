import {
  decideEntries,
  decideExits,
  type EngineMarkedPosition,
  type PaperEngineConfig,
} from "@/lib/engine/decide";
import { parsePaperRulesRow } from "@/lib/engine/rules";
import { writeEventLog } from "@/lib/logs/write";
import {
  applyUsableBookShare,
  DEFAULT_USABLE_BOOK_SHARE,
} from "@/lib/opportunities/capacity";
import { persistOpportunities } from "@/lib/opportunities/persist";
import { scanCarryOpportunities } from "@/lib/opportunities/scan";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import { automationFromLayer } from "@/lib/paper/automation";
import {
  insertPaperOrder,
  priorClosesFromOrders,
  writeCloseClip,
} from "@/lib/paper/ledger";
import { carryPnlPct, carryPnlUsdt } from "@/lib/paper/math";
import { pairKey, paperCarryInsertRow } from "@/lib/paper/open";
import { parsePaperOrderRow } from "@/lib/paper/orders";
import {
  asNullableNumber,
  parsePaperCarryRow,
  type PaperCarryRow,
} from "@/lib/paper/rows";
import { createServiceClient } from "@/lib/supabase/admin";

export async function runPaperEngineTick(): Promise<{
  users: number;
  opened: number;
  closed: number;
  clipped: number;
}> {
  const supabase = createServiceClient();
  if (!supabase) {
    throw new Error("Auth is not configured.");
  }

  const raw = await scanCarryOpportunities();
  await persistOpportunities(raw);

  const [{ data: settingsRows }, { data: ruleRows }, { data: carryRows }, { data: orderRows }] =
    await Promise.all([
      supabase.from("paper_engine_settings").select("user_id, enabled, usable_book_share"),
      supabase.from("paper_rules").select("*").order("sort_order", { ascending: true }),
      supabase.from("paper_carries").select("*").in("status", ["open", "closing"]),
      supabase.from("paper_orders").select("*"),
    ]);

  const orders = (orderRows ?? []).map((row) =>
    parsePaperOrderRow(row as Record<string, unknown>),
  );
  const carries = (carryRows ?? []).map((row) => ({
    userId: String((row as { user_id: string }).user_id),
    row: parsePaperCarryRow(row as Record<string, unknown>),
  }));

  const settingsByUser = new Map<
    string,
    { enabled: boolean; share: number }
  >();
  for (const row of settingsRows ?? []) {
    const share = asNullableNumber(
      (row as { usable_book_share?: unknown }).usable_book_share,
    );
    settingsByUser.set(String((row as { user_id: string }).user_id), {
      enabled: Boolean((row as { enabled?: unknown }).enabled),
      share:
        share !== null && share > 0 && share <= 1
          ? share
          : DEFAULT_USABLE_BOOK_SHARE,
    });
  }

  const layersByUser = new Map<string, PaperEngineConfig["layers"]>();
  for (const row of ruleRows ?? []) {
    const userId = String((row as { user_id: string }).user_id);
    const list = layersByUser.get(userId) ?? [];
    list.push(
      parsePaperRulesRow(
        row as Record<string, unknown>,
        Number((row as { sort_order?: unknown }).sort_order) || list.length,
      ),
    );
    layersByUser.set(userId, list);
  }

  const userIds = new Set<string>([
    ...settingsByUser.keys(),
    ...layersByUser.keys(),
    ...carries.map((item) => item.userId),
  ]);

  let opened = 0;
  let closed = 0;
  let clipped = 0;

  for (const userId of userIds) {
    const settings = settingsByUser.get(userId) ?? {
      enabled: false,
      share: DEFAULT_USABLE_BOOK_SHARE,
    };
    const scan = applyUsableBookShare(raw, settings.share);
    const config: PaperEngineConfig = {
      enabled: settings.enabled,
      layers: layersByUser.get(userId) ?? [],
    };
    const userCarries = carries
      .filter((item) => item.userId === userId)
      .map((item) => item.row);
    const positions = markEnginePositions(userCarries, scan);
    const exits = decideExits(positions, config);

    for (const exit of exits) {
      const row = userCarries.find((item) => item.id === exit.position.id);
      const opportunity = scan.find(
        (item) =>
          pairKey(item.spotSymbol, item.futureSymbol) ===
          pairKey(exit.position.spotSymbol, exit.position.futureSymbol),
      );
      if (!row || !opportunity) {
        continue;
      }
      const written = await writeCloseClip({
        supabase,
        userId,
        row,
        opportunity,
        clipUsdt: exit.closeNotionalUsdt,
        source: row.source === "manual" ? "manual" : "engine",
        reason: exit.reason,
        priorCloses: priorClosesFromOrders(orders, row.id),
      });
      if (written.error) {
        await writeEventLog({
          level: "error",
          scope: "trade",
          event: "engine.close_failed",
          message: written.error,
          userId,
          strategy: "cash-and-carry",
          data: { carryId: row.id, reason: exit.reason },
        });
        continue;
      }
      if (written.kind === "flat") {
        closed += 1;
      } else {
        clipped += 1;
      }
    }

    if (!config.enabled || config.layers.length === 0) {
      continue;
    }

    const entries = decideEntries(
      scan,
      userCarries.map((row) => ({
        spotSymbol: row.spotSymbol,
        futureSymbol: row.futureSymbol,
        notionalUsdt: row.notionalUsdt,
        ruleId: row.ruleId,
        unwinding: row.status === "closing",
      })),
      config,
    );

    for (const entry of entries) {
      const { data, error } = await supabase
        .from("paper_carries")
        .insert(
          paperCarryInsertRow(
            userId,
            entry.opportunity,
            entry.notionalUsdt,
            {
              source: "engine",
              ruleId: entry.layer.id,
              automation: automationFromLayer(entry.layer),
            },
          ),
        )
        .select("id")
        .single();
      if (error || !data) {
        await writeEventLog({
          level: "error",
          scope: "trade",
          event: "engine.open_failed",
          message: error?.message ?? "Insert failed",
          userId,
          strategy: "cash-and-carry",
          data: {
            futureSymbol: entry.opportunity.futureSymbol,
            notionalUsdt: entry.notionalUsdt,
          },
        });
        continue;
      }
      await insertPaperOrder(supabase, {
        userId,
        carryId: Number(data.id),
        side: "open",
        source: "engine",
        triggerReason: null,
        notionalUsdt: entry.notionalUsdt,
        filledAt: new Date(),
        opportunity: entry.opportunity,
        automation: automationFromLayer(entry.layer),
      });
      opened += 1;
    }
  }

  await writeEventLog({
    scope: "system",
    event: "engine.tick",
    message: `Paper engine tick opened ${opened}, closed ${closed}, clipped ${clipped}`,
    strategy: "cash-and-carry",
    data: { users: userIds.size, opened, closed, clipped },
  });

  return { users: userIds.size, opened, closed, clipped };
}

function markEnginePositions(
  rows: PaperCarryRow[],
  scan: ScannedOpportunity[],
): EngineMarkedPosition[] {
  const byPair = new Map(
    scan.map((item) => [pairKey(item.spotSymbol, item.futureSymbol), item]),
  );
  return rows.map((row) => {
    const live = byPair.get(pairKey(row.spotSymbol, row.futureSymbol));
    const unrealized =
      live === undefined
        ? null
        : carryPnlUsdt(
            row.entryBasis,
            live.netBasis,
            row.notionalUsdt,
            live.feeRate,
          );
    return {
      id: row.id,
      spotSymbol: row.spotSymbol,
      futureSymbol: row.futureSymbol,
      notionalUsdt: row.notionalUsdt,
      ruleId: row.ruleId,
      unwinding: row.status === "closing",
      daysToExpiry: live?.daysToExpiry ?? null,
      markNetApr: live?.netApr ?? null,
      pnlPct:
        unrealized === null ? null : carryPnlPct(unrealized, row.notionalUsdt),
      capacityUsdt: live?.capacityUsdt ?? null,
      openedAtMs: row.openedAtMs,
      exits: row.automation,
    };
  });
}
