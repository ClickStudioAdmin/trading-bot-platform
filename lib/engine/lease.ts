export const ENGINE_LEASE_TTL_SECONDS = 45;
export const ENGINE_MUTATION_TTL_SECONDS = 20;
export const ENGINE_CLAIM_BATCH = 4;
export const ENGINE_HOT_CLAIM_BATCH = 24;
export const ENGINE_VENUE_GAP_MS = 150;
export const ENGINE_VENUE_WAIT_CAP_MS = 5_000;
export const ENGINE_DESK_CONCURRENCY = 3;
export const ENGINE_SCAN_KEY = "public_market";
export const ENGINE_SCAN_TTL_SECONDS = 18;
export const ENGINE_LEASE_ENSURE_MS = 10 * 60 * 1000;
export const ENGINE_LOOP_MS = 20_000;
export const ENGINE_INDICATOR_LOOP_MS = 8_000;

export function engineLoopMs(input: {
  indicatorArmed: boolean;
  idleMs?: number;
  indicatorMs?: number;
}): number {
  const idle = Math.max(5_000, Math.floor(input.idleMs ?? ENGINE_LOOP_MS));
  const fast = Math.max(5_000, Math.floor(input.indicatorMs ?? ENGINE_INDICATOR_LOOP_MS));
  return input.indicatorArmed ? Math.min(idle, fast) : idle;
}

export function venueSlotWaitMs(slotStartMs: number, nowMs: number): number {
  const wait = slotStartMs - nowMs;
  if (wait > 0 && wait < ENGINE_VENUE_WAIT_CAP_MS) {
    return wait;
  }
  return 0;
}

export type ScanLease = {
  scanKey: string;
  workerId: string | null;
  leasedUntilMs: number;
};

export type DeskLease = {
  accountId: string;
  workerId: string | null;
  leasedUntilMs: number;
};

function isFree(row: DeskLease, nowMs: number, workerId?: string): boolean {
  if (row.leasedUntilMs < nowMs) {
    return true;
  }
  return Boolean(workerId) && row.workerId === workerId;
}

export function claimEngineDesksFromState(input: {
  leases: readonly DeskLease[];
  workerId: string;
  nowMs: number;
  ttlMs: number;
  limit: number;
  preferAccountIds?: readonly string[];
  excludeAccountIds?: readonly string[];
}): { leases: DeskLease[]; claimed: string[] } {
  const workerId = input.workerId.trim();
  const limit = Math.max(1, Math.min(50, Math.floor(input.limit)));
  const ttlMs = Math.max(5_000, Math.floor(input.ttlMs));
  const prefer = new Set(input.preferAccountIds ?? []);
  const exclude = new Set(input.excludeAccountIds ?? []);
  const next = input.leases.map((row) => ({ ...row }));
  const free = next
    .filter(
      (row) =>
        row.leasedUntilMs < input.nowMs && !exclude.has(row.accountId),
    )
    .sort((a, b) => {
      const aHot = prefer.has(a.accountId) ? 0 : 1;
      const bHot = prefer.has(b.accountId) ? 0 : 1;
      if (aHot !== bHot) {
        return aHot - bHot;
      }
      if (a.leasedUntilMs !== b.leasedUntilMs) {
        return a.leasedUntilMs - b.leasedUntilMs;
      }
      return a.accountId.localeCompare(b.accountId);
    });
  const claimed: string[] = [];
  for (const row of free) {
    if (claimed.length >= limit) {
      break;
    }
    row.workerId = workerId;
    row.leasedUntilMs = input.nowMs + ttlMs;
    claimed.push(row.accountId);
  }
  return { leases: next, claimed };
}

export function tryClaimEngineDeskFromState(input: {
  leases: readonly DeskLease[];
  accountId: string;
  workerId: string;
  nowMs: number;
  ttlMs: number;
}): { leases: DeskLease[]; ok: boolean } {
  const workerId = input.workerId.trim();
  const ttlMs = Math.max(5_000, Math.floor(input.ttlMs));
  const next = input.leases.map((row) => ({ ...row }));
  let row = next.find((item) => item.accountId === input.accountId);
  if (!row) {
    row = {
      accountId: input.accountId,
      workerId: null,
      leasedUntilMs: 0,
    };
    next.push(row);
  }
  if (!isFree(row, input.nowMs, workerId)) {
    return { leases: next, ok: false };
  }
  row.workerId = workerId;
  row.leasedUntilMs = input.nowMs + ttlMs;
  return { leases: next, ok: true };
}

export function releaseEngineDeskFromState(input: {
  leases: readonly DeskLease[];
  accountId: string;
  workerId: string;
}): DeskLease[] {
  const workerId = input.workerId.trim();
  return input.leases.map((row) => {
    if (row.accountId !== input.accountId || row.workerId !== workerId) {
      return { ...row };
    }
    return {
      accountId: row.accountId,
      workerId: null,
      leasedUntilMs: 0,
    };
  });
}

export function tryClaimEngineScanFromState(input: {
  leases: readonly ScanLease[];
  scanKey: string;
  workerId: string;
  nowMs: number;
  ttlMs: number;
}): { leases: ScanLease[]; ok: boolean } {
  const scanKey = input.scanKey.trim() || "public_market";
  const workerId = input.workerId.trim();
  const ttlMs = Math.max(5_000, Math.floor(input.ttlMs));
  const next = input.leases.map((row) => ({ ...row }));
  let row = next.find((item) => item.scanKey === scanKey);
  if (!row) {
    row = {
      scanKey,
      workerId: null,
      leasedUntilMs: 0,
    };
    next.push(row);
  }
  if (row.leasedUntilMs >= input.nowMs) {
    return { leases: next, ok: false };
  }
  row.workerId = workerId;
  row.leasedUntilMs = input.nowMs + ttlMs;
  return { leases: next, ok: true };
}
