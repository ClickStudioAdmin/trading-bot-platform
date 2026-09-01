import {
  pickDisplayLeverage,
  type VenueAccountSnapshot,
} from "@/lib/exchanges/account-view";
import { loadHyperliquidUserState } from "./info";

export async function hyperliquidReadAccountSnapshot(input: {
  environmentId: string;
  accountAddress: string;
}): Promise<
  { ok: true; snapshot: VenueAccountSnapshot } | { ok: false; error: string }
> {
  try {
    const state = await loadHyperliquidUserState({
      environmentId: input.environmentId,
      accountAddress: input.accountAddress,
    });
    const used = state.totalMarginUsed;
    const value = state.accountValue;
    const rate =
      used !== null && value !== null && value > 0 ? used / value : null;
    return {
      ok: true,
      snapshot: {
        marginMode: "cross",
        leverage: pickDisplayLeverage(
          state.positions.map((row) => row.leverage),
        ),
        initialMarginRate: rate,
        maintenanceMarginRate: null,
        marginBalance: value,
        availableBalance: state.withdrawable,
      },
    };
  } catch {
    return { ok: false, error: "Could not read the Hyperliquid account." };
  }
}
