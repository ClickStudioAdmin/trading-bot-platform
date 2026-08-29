import { deskHref } from "@/lib/accounts/model";
import { getSessionContext } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function CashAndCarryIndexPage() {
  const session = await getSessionContext();
  redirect(
    deskHref("/strategies/cash-and-carry/positions", session?.account.id),
  );
}
