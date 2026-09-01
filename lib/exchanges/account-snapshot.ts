import { cache } from "react";
import { listLinearPositionRisk } from "./execute";
import { bybitReadAccountSnapshot } from "./bybit/account";
import { normalizeAddress } from "./hyperliquid/agent";
import { hyperliquidReadAccountSnapshot } from "./hyperliquid/account";
import { pickDisplayLeverage, type AccountSnapshotView } from "./account-view";
import { loadBoundConnectionSecrets } from "./store";

export type { AccountSnapshotView } from "./account-view";

function creds(credentials: Record<string, string>) {
  return {
    apiKey: credentials.apiKey,
    apiSecret: credentials.apiSecret,
  };
}

export const loadAccountSnapshot = cache(async (
  userId: string,
  connectionId: string,
): Promise<AccountSnapshotView> => {
  const bound = await loadBoundConnectionSecrets({
    userId,
    connectionId,
  });
  if (!bound.ok) {
    return { ok: false, error: bound.error };
  }
  if (bound.connection.venue === "hyperliquid") {
    const accountAddress = normalizeAddress(
      bound.connection.credentials.accountAddress,
    );
    if (!accountAddress) {
      return { ok: false, error: "Could not read the Hyperliquid account." };
    }
    const read = await hyperliquidReadAccountSnapshot({
      environmentId: bound.connection.environment,
      accountAddress,
    });
    if (!read.ok) {
      return { ok: false, error: read.error };
    }
    return { ok: true, snapshot: read.snapshot };
  }
  if (bound.connection.venue !== "bybit") {
    return {
      ok: false,
      error: "That exchange does not report an account yet.",
    };
  }
  const read = await bybitReadAccountSnapshot({
    environmentId: bound.connection.environment,
    credentials: creds(bound.connection.credentials),
  });
  if (!read.ok) {
    return { ok: false, error: "Could not read the unified account." };
  }
  const listed = await listLinearPositionRisk({
    connection: bound.connection,
  });
  const leverage = listed.ok
    ? pickDisplayLeverage(listed.positions.map((row) => row.leverage))
    : null;
  return {
    ok: true,
    snapshot: { ...read.snapshot, leverage },
  };
});

export async function loadAccountSnapshots(
  userId: string,
  connectionIds: string[],
): Promise<Map<string, AccountSnapshotView>> {
  const unique = [...new Set(connectionIds.filter(Boolean))];
  const rows = await Promise.all(
    unique.map(async (connectionId) => {
      const view = await loadAccountSnapshot(userId, connectionId);
      return [connectionId, view] as const;
    }),
  );
  return new Map(rows);
}
