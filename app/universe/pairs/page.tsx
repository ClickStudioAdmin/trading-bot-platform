import { exchangePairsHref } from "@/lib/pairs/page";
import { redirect } from "next/navigation";

export default function UniversePairsRedirect() {
  redirect(exchangePairsHref("bybit", { kind: "carry" }));
}
