import { listEventLogs } from "@/lib/logs/list";
import {
  stampFromSyncFailedData,
  type DcaSyncFailureStamp,
} from "./sync-failure";

const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export async function loadRecentDcaSyncFailures(input: {
  accountId: string;
  playbookId: string;
}): Promise<DcaSyncFailureStamp[]> {
  const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const rows = await listEventLogs(
    { scope: "trade", level: "", event: "dca.sync_failed" },
    {
      accountId: input.accountId,
      scopes: ["trade"],
      since,
      limit: 80,
    },
  );
  const stamps: DcaSyncFailureStamp[] = [];
  for (const row of rows) {
    if (String(row.data.playbookId ?? "") !== input.playbookId) {
      continue;
    }
    const stamp = stampFromSyncFailedData(
      input.playbookId,
      row.data,
      row.message,
    );
    if (stamp) {
      stamps.push(stamp);
    }
  }
  return stamps;
}
