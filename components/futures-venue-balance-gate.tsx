"use client";

import { usePathname } from "next/navigation";
import { FuturesVenueBalance } from "@/components/futures-venue-balance";
import type { AccountSnapshotView } from "@/lib/exchanges/account-view";
import { FUTURES_PATHS } from "@/lib/strategies/registry";

export function FuturesVenueBalanceGate({
  snapshot,
}: {
  snapshot: AccountSnapshotView;
}) {
  const pathname = usePathname();
  if (
    pathname !== FUTURES_PATHS.root &&
    pathname !== FUTURES_PATHS.positions
  ) {
    return null;
  }
  return <FuturesVenueBalance snapshot={snapshot} />;
}
