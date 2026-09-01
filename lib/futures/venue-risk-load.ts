import { listLinearPositionRisk } from "@/lib/exchanges/execute";
import { loadBoundVenueForAccount } from "@/lib/exchanges/live-trade";
import type { BoundConnectionSecrets } from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { getSessionContext } from "@/lib/auth/session";
import type { FuturesSide } from "./model";
import { loadFuturesSettings } from "./settings";
import {
  futuresVenueRiskKey,
  mapLinearPositionRisk,
  type FuturesVenueRisk,
} from "./venue-risk";

export async function resolveWriteLeverage(input: {
  connection: BoundConnectionSecrets | null;
  accountId: string;
  symbol: string;
  side: FuturesSide;
  current?: number | null;
}): Promise<number | null> {
  if (input.connection) {
    const listed = await listLinearPositionRisk({
      connection: input.connection,
    });
    if (listed.ok) {
      const found = mapLinearPositionRisk(listed.positions).get(
        futuresVenueRiskKey(input.symbol, input.side),
      );
      if (found?.leverage != null) {
        return found.leverage;
      }
    }
    return input.current ?? null;
  }
  const settings = await loadFuturesSettings(input.accountId);
  return settings.paperLeverage ?? input.current ?? null;
}

export async function loadFuturesVenueRisk(): Promise<
  Map<string, FuturesVenueRisk>
> {
  const empty = new Map<string, FuturesVenueRisk>();
  const session = await getSessionContext();
  if (!session || !accountCanHoldConnections(session.account.mode)) {
    return empty;
  }
  const settings = await loadFuturesSettings(session.account.id);
  if (!settings.connectionId) {
    return empty;
  }
  const bound = await loadBoundVenueForAccount({
    userId: session.member.id,
    accountId: session.account.id,
    mode: session.account.mode,
    connectionId: settings.connectionId,
  });
  if (!bound.ok) {
    return empty;
  }
  const listed = await listLinearPositionRisk({
    connection: bound.connection,
  });
  if (!listed.ok) {
    return empty;
  }
  return mapLinearPositionRisk(listed.positions);
}
