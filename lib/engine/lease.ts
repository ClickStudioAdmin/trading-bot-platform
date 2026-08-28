export const ENGINE_LEASE_TTL_SECONDS = 45;
export const ENGINE_MUTATION_TTL_SECONDS = 20;
export const ENGINE_CLAIM_BATCH = 4;
export const ENGINE_VENUE_GAP_MS = 150;

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
}): { leases: DeskLease[]; claimed: string[] } {
  const workerId = input.workerId.trim();
  const limit = Math.max(1, Math.min(50, Math.floor(input.limit)));
  const ttlMs = Math.max(5_000, Math.floor(input.ttlMs));
  const next = input.leases.map((row) => ({ ...row }));
  const free = next
    .filter((row) => row.leasedUntilMs < input.nowMs)
    .sort((a, b) => {
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
