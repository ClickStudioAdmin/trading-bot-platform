export const DCA_TRADE_SLOT_MS = 100;

export type DcaTradeSlotState = {
  nextAtMs: number;
};

export function reserveDcaTradeSlot(
  nowMs: number,
  state: DcaTradeSlotState,
): number {
  const start = Math.max(nowMs, state.nextAtMs);
  state.nextAtMs = start + DCA_TRADE_SLOT_MS;
  return start;
}

const slotState: DcaTradeSlotState = { nextAtMs: 0 };

export async function takeDcaTradeSlot(): Promise<void> {
  const start = reserveDcaTradeSlot(Date.now(), slotState);
  const wait = start - Date.now();
  if (wait > 0) {
    await new Promise((resolve) => {
      setTimeout(resolve, wait);
    });
  }
}
