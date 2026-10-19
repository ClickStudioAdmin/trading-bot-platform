import { deskBetaNotice } from "@/lib/exchanges/availability";
import { loadExchangeAvailability } from "@/lib/exchanges/availability-store";

export async function DeskBetaNotice({
  account,
}: {
  account: {
    deskType: string;
    venue: string;
    mode: "paper" | "live";
    venueEnvironment: string | null;
  };
}) {
  const cells = await loadExchangeAvailability();
  const notice = deskBetaNotice({
    cells,
    deskType: account.deskType,
    venueId: account.venue,
    accountMode: account.mode,
    environmentId: account.venueEnvironment,
  });
  if (!notice) {
    return null;
  }
  return (
    <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
      {notice}
    </p>
  );
}
