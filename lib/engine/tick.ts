import {
  decideEntries,
  decideExits,
  layerAllowsEntries,
  type EngineMarkedPosition,
  type PaperEngineConfig,
} from "@/lib/engine/decide";
import {
  boundVenueForTick,
  closeLiveCarry,
  flattenLiveOpen,
  openLiveCarry,
} from "@/lib/engine/live-tick";
import { parsePaperRulesRow } from "@/lib/engine/rules";
import { selectPaperEngineSettings } from "@/lib/engine/settings";
import { writeEventLog } from "@/lib/logs/write";
import type { VenueFill } from "@/lib/exchanges/execute";
import { venueOrderFields } from "@/lib/exchanges/live-trade";
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
  writeOpenClip,
} from "@/lib/paper/ledger";
import { carryPnlPct, carryPnlUsdt } from "@/lib/paper/math";
import { pairKey, paperCarryInsertRow } from "@/lib/paper/open";
import { clipFillBasis, parsePaperOrderRow } from "@/lib/paper/orders";
import {
  asNullableNumber,
  parsePaperCarryRow,
  pickOpenCarryForPair,
  type PaperCarryRow,
} from "@/lib/paper/rows";
import { createServiceClient } from "@/lib/supabase/admin";

export async function runPaperEngineTick(): Promise<{
  users: number;
  opened: number;
  closed: number;
  clipped: number;
  added: number;
}> {
  const supabase = createServiceClient();
  if (!supabase) {
    throw new Error("Auth is not configured.");
  }

  const raw = await scanCarryOpportunities();
  await persistOpportunities(raw);

  const [
    { data: accountRows },
    settingsRows,
    { data: ruleRows },
    { data: carryRows },
    { data: orderRows },
  ] = await Promise.all([
    supabase.from("trading_accounts").select("id, user_id, mode"),
    selectPaperEngineSettings(supabase),
    supabase.from("paper_rules").select("*").order("sort_order", { ascending: true }),
    supabase.from("paper_carries").select("*").in("status", ["open", "closing"]),
    supabase.from("paper_orders").select("*"),
  ]);

  const orders = (orderRows ?? []).map((row) =>
    parsePaperOrderRow(row as Record<string, unknown>),
  );
  const carries = (carryRows ?? []).map((row) => ({
    userId: String((row as { user_id: string }).user_id),
    accountId: String((row as { account_id: string }).account_id),
    row: parsePaperCarryRow(row as Record<string, unknown>),
  }));

  const settingsByAccount = new Map<
    string,
    {
      enabled: boolean;
      reduceOnly: boolean;
      share: number;
      connectionId: string | null;
    }
  >();
  for (const row of settingsRows) {
    const share = asNullableNumber(
      (row as { usable_book_share?: unknown }).usable_book_share,
    );
    const connectionId = String(
      (row as { exchange_connection_id?: unknown }).exchange_connection_id ?? "",
    ).trim();
    settingsByAccount.set(String((row as { account_id: string }).account_id), {
      enabled: Boolean((row as { enabled?: unknown }).enabled),
      reduceOnly: Boolean((row as { reduce_only?: unknown }).reduce_only),
      share:
        share !== null && share > 0 && share <= 1
          ? share
          : DEFAULT_USABLE_BOOK_SHARE,
      connectionId: connectionId || null,
    });
  }

  const layersByAccount = new Map<string, PaperEngineConfig["layers"]>();
  for (const row of ruleRows ?? []) {
    const accountId = String((row as { account_id: string }).account_id);
    const list = layersByAccount.get(accountId) ?? [];
    list.push(
      parsePaperRulesRow(
        row as Record<string, unknown>,
        Number((row as { sort_order?: unknown }).sort_order) || list.length,
      ),
    );
    layersByAccount.set(accountId, list);
  }

  const accounts = (accountRows ?? []).map((row) => ({
    id: String((row as { id: string }).id),
    userId: String((row as { user_id: string }).user_id),
    mode: String((row as { mode: string }).mode),
  }));
  const userIds = new Set(accounts.map((account) => account.userId));

  let opened = 0;
  let closed = 0;
  let clipped = 0;
  let added = 0;

  for (const account of accounts) {
    const userId = account.userId;
    const settings = settingsByAccount.get(account.id) ?? {
      enabled: false,
      reduceOnly: false,
      share: DEFAULT_USABLE_BOOK_SHARE,
      connectionId: null,
    };
    const layers = layersByAccount.get(account.id) ?? [];
    const userCarries = carries
      .filter((item) => item.accountId === account.id)
      .map((item) => item.row);
    const venue = await boundVenueForTick({
      userId,
      accountId: account.id,
      mode: account.mode,
      connectionId: settings.connectionId,
    });
    if (venue.live && !venue.ok) {
      const wantsEngine =
        settings.enabled ||
        userCarries.length > 0 ||
        layers.some((layer) => layerAllowsEntries(layer, settings.reduceOnly));
      if (wantsEngine) {
        await writeEventLog({
          level: "warning",
          scope: "trade",
          event: "engine.skip_live",
          message: venue.error,
          userId,
          accountId: account.id,
          strategy: "cash-and-carry",
        });
      }
      continue;
    }
    const liveVenue = venue.live ? venue.connection : null;
    const scan = applyUsableBookShare(raw, settings.share);
    const config: PaperEngineConfig = {
      enabled: settings.enabled,
      reduceOnly: settings.reduceOnly,
      layers,
    };
    const flattened = new Set<number>();
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
      const carryOrders = orders.filter((order) => order.carryId === row.id);
      let venueClose: VenueFill | null = null;
      if (liveVenue) {
        const closedOnVenue = await closeLiveCarry({
          connection: liveVenue,
          row,
          opportunity,
          orders: carryOrders,
          clipUsdt: exit.closeNotionalUsdt,
        });
        if (!closedOnVenue.ok) {
          await writeEventLog({
            level: "error",
            scope: "trade",
            event: "engine.close_failed",
            message: closedOnVenue.error,
            userId,
            accountId: account.id,
            strategy: "cash-and-carry",
            data: { carryId: row.id, reason: exit.reason, venue: liveVenue.venue },
          });
          continue;
        }
        venueClose = closedOnVenue.fill;
      }
      const written = await writeCloseClip({
        supabase,
        userId,
        accountId: account.id,
        row,
        opportunity,
        clipUsdt: exit.closeNotionalUsdt,
        source: row.source === "manual" ? "manual" : "engine",
        reason: exit.reason,
        priorCloses: priorClosesFromOrders(orders, row.id),
        ...venueOrderFields(venueClose),
      });
      if (written.error) {
        await writeEventLog({
          level: "error",
          scope: "trade",
          event: "engine.close_failed",
          message: written.error,
          userId,
          accountId: account.id,
          strategy: "cash-and-carry",
          data: { carryId: row.id, reason: exit.reason },
        });
        continue;
      }
      if (written.kind === "flat") {
        closed += 1;
        flattened.add(row.id);
      } else {
        clipped += 1;
      }
      await writeEventLog({
        scope: "trade",
        event: written.kind === "flat" ? "trade.closed" : "trade.unwound",
        message:
          written.kind === "flat"
            ? liveVenue
              ? `Closed ${row.futureSymbol} on the connected exchange`
              : `Closed paper ${row.futureSymbol}`
            : liveVenue
              ? `Unwound ${row.futureSymbol} on the connected exchange`
              : `Unwound paper ${row.futureSymbol}`,
        userId,
        accountId: account.id,
        strategy: "cash-and-carry",
        data: {
          carryId: row.id,
          futureSymbol: row.futureSymbol,
          clipUsdt: exit.closeNotionalUsdt,
          source: row.source,
          closeSource: row.source === "manual" ? "manual" : "engine",
          reason: exit.reason,
          venue: venueClose?.venue,
        },
      });
    }

    if (
      !config.layers.some((layer) =>
        layerAllowsEntries(layer, Boolean(config.reduceOnly)),
      )
    ) {
      continue;
    }

    const entries = decideEntries(
      scan,
      userCarries.map((row) => ({
        id: row.id,
        spotSymbol: row.spotSymbol,
        futureSymbol: row.futureSymbol,
        notionalUsdt: row.notionalUsdt,
        ruleId: row.ruleId,
        unwinding: row.status === "closing" || flattened.has(row.id),
        openedAtMs: row.openedAtMs,
      })),
      config,
    );

    for (const entry of entries) {
      const existing =
        entry.carryId !== null
          ? userCarries.find(
              (item) => item.id === entry.carryId && !flattened.has(item.id),
            )
          : liveVenue
            ? pickOpenCarryForPair(
                userCarries.filter(
                  (item) => item.status === "open" && !flattened.has(item.id),
                ),
                entry.opportunity.spotSymbol,
                entry.opportunity.futureSymbol,
              )
            : null;
      if (entry.carryId !== null && !existing) {
        continue;
      }

      let venueFill: VenueFill | null = null;
      if (liveVenue) {
        const openedOnVenue = await openLiveCarry({
          connection: liveVenue,
          opportunity: entry.opportunity,
          notionalUsdt: entry.notionalUsdt,
        });
        if (!openedOnVenue.ok) {
          await writeEventLog({
            level: "error",
            scope: "trade",
            event: "engine.open_failed",
            message: openedOnVenue.error,
            userId,
            accountId: account.id,
            strategy: "cash-and-carry",
            data: {
              futureSymbol: entry.opportunity.futureSymbol,
              notionalUsdt: entry.notionalUsdt,
              venue: liveVenue.venue,
            },
          });
          continue;
        }
        venueFill = openedOnVenue.fill;
      }

      async function flattenIfNeeded() {
        if (!liveVenue || !venueFill) {
          return;
        }
        await flattenLiveOpen({
          connection: liveVenue,
          opportunity: entry.opportunity,
          qty: venueFill.qty,
        });
      }

      if (existing) {
        const written = await writeOpenClip({
          supabase,
          userId,
          accountId: account.id,
          row: existing,
          opportunity: entry.opportunity,
          clipUsdt: entry.notionalUsdt,
          ...venueOrderFields(venueFill),
        });
        if (written.error) {
          await flattenIfNeeded();
          await writeEventLog({
            level: "error",
            scope: "trade",
            event: "engine.open_failed",
            message: written.error,
            userId,
            accountId: account.id,
            strategy: "cash-and-carry",
            data: {
              carryId: existing.id,
              futureSymbol: entry.opportunity.futureSymbol,
              notionalUsdt: entry.notionalUsdt,
            },
          });
          continue;
        }
        added += 1;
        await writeEventLog({
          scope: "trade",
          event: "trade.added",
          message: liveVenue
            ? `Added ${entry.opportunity.futureSymbol} on the connected exchange`
            : `Added paper ${entry.opportunity.futureSymbol}`,
          userId,
          accountId: account.id,
          strategy: "cash-and-carry",
          data: {
            carryId: existing.id,
            futureSymbol: entry.opportunity.futureSymbol,
            notionalUsdt: entry.notionalUsdt,
            source: "engine",
            venue: venueFill?.venue,
          },
        });
        continue;
      }

      const { data, error } = await supabase
        .from("paper_carries")
        .insert(
          paperCarryInsertRow(
            userId,
            entry.opportunity,
            entry.notionalUsdt,
            {
              accountId: account.id,
              source: "engine",
              ruleId: entry.layer.id,
              ruleName: entry.layer.name,
              automation: automationFromLayer(entry.layer),
              entryBasis: clipFillBasis(
                entry.opportunity,
                venueFill?.spotPrice,
                venueFill?.futurePrice,
              ),
            },
          ),
        )
        .select("id")
        .single();
      if (error || !data) {
        await flattenIfNeeded();
        await writeEventLog({
          level: "error",
          scope: "trade",
          event: "engine.open_failed",
          message: error?.message ?? "Insert failed",
          userId,
          accountId: account.id,
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
        accountId: account.id,
        carryId: Number(data.id),
        side: "open",
        source: "engine",
        triggerReason: null,
        notionalUsdt: entry.notionalUsdt,
        filledAt: new Date(),
        opportunity: entry.opportunity,
        automation: automationFromLayer(entry.layer),
        ...venueOrderFields(venueFill),
      });
      opened += 1;
      await writeEventLog({
        scope: "trade",
        event: "trade.opened",
        message: liveVenue
          ? `Opened ${entry.opportunity.futureSymbol} on the connected exchange`
          : `Opened paper ${entry.opportunity.futureSymbol}`,
        userId,
        accountId: account.id,
        strategy: "cash-and-carry",
        data: {
          carryId: Number(data.id),
          spotSymbol: entry.opportunity.spotSymbol,
          futureSymbol: entry.opportunity.futureSymbol,
          notionalUsdt: entry.notionalUsdt,
          entryBasis: entry.opportunity.netBasis,
          source: "engine",
          ruleName: entry.layer.name,
          venue: venueFill?.venue,
        },
      });
    }
  }

  await writeEventLog({
    scope: "system",
    event: "engine.tick",
    message: `Engine tick opened ${opened}, added ${added}, closed ${closed}, clipped ${clipped}`,
    strategy: "cash-and-carry",
    data: {
      users: userIds.size,
      accounts: accounts.length,
      opened,
      added,
      closed,
      clipped,
    },
  });

  return { users: userIds.size, opened, added, closed, clipped };
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
