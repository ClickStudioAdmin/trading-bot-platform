export const DCA_TICK_ENTRY_RANK = 6;
export const DCA_TICK_ENTRY_BATCH = 8;
export const DCA_TICK_LANE_CONCURRENCY = 4;
export const DCA_TICK_PRICE_CONCURRENCY = 10;

export type DcaTickWorkKind =
  | "flatten"
  | "close"
  | "breakeven"
  | "disarm"
  | "stop_adding"
  | "sync"
  | "end_cycle"
  | "arm"
  | "clip";

export function dcaTickWorkRank(kind: DcaTickWorkKind): number {
  switch (kind) {
    case "flatten":
    case "close":
      return 0;
    case "sync":
      return 1;
    case "breakeven":
      return 2;
    case "disarm":
      return 3;
    case "stop_adding":
      return 4;
    case "end_cycle":
      return 5;
    case "arm":
    case "clip":
      return DCA_TICK_ENTRY_RANK;
  }
}

export function sliceDcaTickEntries<T>(
  entries: readonly T[],
  batch: number,
  offset = 0,
): { taken: T[]; nextOffset: number } {
  const room = Math.max(0, Math.floor(batch));
  if (entries.length === 0 || room === 0) {
    return { taken: [], nextOffset: 0 };
  }
  if (entries.length <= room) {
    return { taken: [...entries], nextOffset: 0 };
  }
  const start =
    ((Math.floor(offset) % entries.length) + entries.length) % entries.length;
  const taken: T[] = [];
  for (let index = 0; index < room; index += 1) {
    const row = entries[(start + index) % entries.length];
    if (row !== undefined) {
      taken.push(row);
    }
  }
  return { taken, nextOffset: (start + room) % entries.length };
}

export function groupDcaTickSymbols<T extends { symbol: string }>(
  items: readonly T[],
): T[][] {
  const groups: T[][] = [];
  const indexBySymbol = new Map<string, number>();
  for (const item of items) {
    const at = indexBySymbol.get(item.symbol);
    if (at === undefined) {
      indexBySymbol.set(item.symbol, groups.length);
      groups.push([item]);
    } else {
      const group = groups[at];
      if (group) {
        group.push(item);
      }
    }
  }
  return groups;
}

export function orderDcaTickWork<T extends { rank: number }>(
  items: readonly T[],
  entryBatch = DCA_TICK_ENTRY_BATCH,
  entryOffset = 0,
): { items: T[]; nextEntryOffset: number } {
  const protective: T[] = [];
  const entries: T[] = [];
  for (const item of items) {
    if (item.rank >= DCA_TICK_ENTRY_RANK) {
      entries.push(item);
    } else {
      protective.push(item);
    }
  }
  protective.sort((left, right) => left.rank - right.rank);
  const sliced = sliceDcaTickEntries(entries, entryBatch, entryOffset);
  return {
    items: [...protective, ...sliced.taken],
    nextEntryOffset: sliced.nextOffset,
  };
}
