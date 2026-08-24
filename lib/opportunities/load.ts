import {
  loadStoredOpportunities,
  persistOpportunities,
} from "@/lib/opportunities/persist";
import { scanCarryOpportunities } from "@/lib/opportunities/scan";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";

const FRESH_MS = 90_000;

export async function loadOpportunityBook(
  preference: "fresh" | "stored",
): Promise<{
  rows: ScannedOpportunity[];
  scannedAtMs: number | null;
  error: string | null;
}> {
  const stored = await loadStoredOpportunities();
  const ageMs =
    stored.scannedAtMs === null
      ? Number.POSITIVE_INFINITY
      : Date.now() - stored.scannedAtMs;
  const useStored =
    stored.rows.length > 0 &&
    (preference === "stored" || ageMs < FRESH_MS);

  if (useStored) {
    return { rows: stored.rows, scannedAtMs: stored.scannedAtMs, error: null };
  }

  try {
    const rows = await scanCarryOpportunities();
    await persistOpportunities(rows);
    return { rows, scannedAtMs: Date.now(), error: null };
  } catch (cause) {
    return {
      rows: stored.rows,
      scannedAtMs: stored.scannedAtMs,
      error: cause instanceof Error ? cause.message : "Scan failed",
    };
  }
}
