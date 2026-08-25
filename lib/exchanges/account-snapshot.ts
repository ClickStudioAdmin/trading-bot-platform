import { cache } from "react";
import { bybitReadAccountSnapshot } from "./bybit/account";
import type { AccountSnapshotView } from "./account-view";
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
  accountId: string,
  connectionId: string,
): Promise<AccountSnapshotView> => {
  const bound = await loadBoundConnectionSecrets({
    userId,
    accountId,
    connectionId,
  });
  if (!bound.ok) {
    return { ok: false, error: bound.error };
  }
  if (bound.connection.venue !== "bybit") {
    return {
      ok: false,
      error: "That exchange does not report a unified account yet.",
    };
  }
  const read = await bybitReadAccountSnapshot({
    environmentId: bound.connection.environment,
    credentials: creds(bound.connection.credentials),
  });
  if (!read.ok) {
    return { ok: false, error: "Could not read the unified account." };
  }
  return { ok: true, snapshot: read.snapshot };
});

export async function loadAccountSnapshots(
  userId: string,
  accountId: string,
  connectionIds: string[],
): Promise<Map<string, AccountSnapshotView>> {
  const unique = [...new Set(connectionIds.filter(Boolean))];
  const rows = await Promise.all(
    unique.map(async (connectionId) => {
      const view = await loadAccountSnapshot(userId, accountId, connectionId);
      return [connectionId, view] as const;
    }),
  );
  return new Map(rows);
}
