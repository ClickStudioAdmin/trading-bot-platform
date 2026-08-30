import { listLinearPositionRisk } from "@/lib/exchanges/execute";
import { loadBoundVenueForAccount } from "@/lib/exchanges/live-trade";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { getSessionContext } from "@/lib/auth/session";
import { loadFuturesSettings } from "./settings";
import {
  mapLinearPositionRisk,
  type FuturesVenueRisk,
} from "./venue-risk";

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
