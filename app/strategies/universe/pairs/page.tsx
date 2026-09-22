import { exchangePairsHref } from "@/lib/pairs/page";
import { redirect } from "next/navigation";

export default function StrategyUniversePairsRedirect() {
  redirect(exchangePairsHref("bybit", { kind: "carry" }));
}
