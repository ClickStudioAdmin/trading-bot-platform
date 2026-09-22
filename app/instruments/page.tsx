import { exchangePairsHref } from "@/lib/pairs/page";
import { redirect } from "next/navigation";

export default function InstrumentsRedirect() {
  redirect(exchangePairsHref("bybit", { kind: "carry" }));
}
