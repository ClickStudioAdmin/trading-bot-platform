import type { FuturesCommandFlash } from "./command";

const PLACE_NOTICES: Partial<Record<FuturesCommandFlash, string>> = {
  opened: "Paper futures opened.",
  added: "Paper size added.",
  working: "Paper limit is working.",
  "live-opened": "Futures opened on the connected exchange.",
  "live-added": "Size added on the connected exchange.",
  "live-working": "Limit working on the connected exchange.",
};

export function futuresPlaceNotice(flash: FuturesCommandFlash): string {
  return PLACE_NOTICES[flash] ?? "Order placed.";
}
