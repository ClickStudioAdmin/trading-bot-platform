import { loadEngineSettings } from "@/lib/engine/settings";
import {
  loadBoundConnectionSecrets,
  type BoundConnectionSecrets,
} from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import type { TradingAccountMode } from "@/lib/accounts/model";

export async function loadBoundVenueForAccount(input: {
  userId: string;
  accountId: string;
  mode: TradingAccountMode;
}): Promise<
  { ok: true; connection: BoundConnectionSecrets } | { ok: false; error: string }
> {
  if (!accountCanHoldConnections(input.mode)) {
    return { ok: false, error: "This book does not hold exchange keys." };
  }
  const settings = await loadEngineSettings();
  if (!settings.connectionId) {
    return {
      ok: false,
      error: "Bind an exchange in Strategy Settings before opening.",
    };
  }
  return loadBoundConnectionSecrets({
    userId: input.userId,
    accountId: input.accountId,
    connectionId: settings.connectionId,
  });
}

export function qtyTextFromFill(qty: number | null, fallback: string): string {
  if (qty !== null && qty > 0) {
    return String(Number(qty.toPrecision(12)));
  }
  return fallback;
}
