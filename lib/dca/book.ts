import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { loadAccountSnapshot } from "@/lib/exchanges/account-snapshot";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { loadFuturesPositions } from "@/lib/futures/list";
import { COPY_PAPER_STARTING_USDT } from "@/lib/copy/decide";

export function dcaPaperBookUsdt(realizedUsdt: number): number {
  return COPY_PAPER_STARTING_USDT + realizedUsdt;
}

export async function loadDcaBookUsdt(input: {
  userId: string;
  accountId: string;
  mode: "paper" | "live";
}): Promise<number | null> {
  if (accountCanHoldConnections(input.mode)) {
    const settings = await loadFuturesSettings(input.accountId);
    if (!settings.connectionId) {
      return null;
    }
    const snapshot = await loadAccountSnapshot(
      input.userId,
      settings.connectionId,
    );
    if (!snapshot.ok) {
      return null;
    }
    const available = snapshot.snapshot.availableBalance;
    return available != null && Number.isFinite(available) && available > 0
      ? available
      : null;
  }
  const positions = await loadFuturesPositions({
    scope: { accountId: input.accountId, userId: input.userId },
  });
  const realized = positions.reduce((sum, row) => sum + row.realizedUsdt, 0);
  const book = dcaPaperBookUsdt(realized);
  return Number.isFinite(book) ? book : null;
}
