import { FuturesFlash } from "@/components/futures-flash";
import { firstSearchValue } from "@/lib/paper/open";

export function HyperliquidDeskFlash({
  params,
  includeWebhookArm = false,
}: {
  params: Record<string, string | string[] | undefined>;
  includeWebhookArm?: boolean;
}) {
  return (
    <FuturesFlash
      opened={firstSearchValue(params.paper) === "opened"}
      added={firstSearchValue(params.paper) === "added"}
      closed={firstSearchValue(params.paper) === "closed"}
      working={firstSearchValue(params.paper) === "working"}
      cancelled={firstSearchValue(params.paper) === "cancelled"}
      amended={firstSearchValue(params.paper) === "amended"}
      liveOpened={firstSearchValue(params.paper) === "live-opened"}
      liveAdded={firstSearchValue(params.paper) === "live-added"}
      liveClosed={firstSearchValue(params.paper) === "live-closed"}
      liveWorking={firstSearchValue(params.paper) === "live-working"}
      liveAmended={firstSearchValue(params.paper) === "live-amended"}
      tpsl={firstSearchValue(params.paper) === "tpsl"}
      liveTpsl={firstSearchValue(params.paper) === "live-tpsl"}
      trailing={firstSearchValue(params.paper) === "trailing"}
      liveTrailing={firstSearchValue(params.paper) === "live-trailing"}
      closedAll={firstSearchValue(params.paper) === "closed-all"}
      liveClosedAll={firstSearchValue(params.paper) === "live-closed-all"}
      cancelledAll={firstSearchValue(params.paper) === "cancelled-all"}
      closedAndCancelled={
        firstSearchValue(params.paper) === "closed-and-cancelled"
      }
      liveClosedAndCancelled={
        firstSearchValue(params.paper) === "live-closed-and-cancelled"
      }
      webhookArm={
        includeWebhookArm
          ? firstSearchValue(params.paper) === "webhook-arm"
          : undefined
      }
      playbookClosed={firstSearchValue(params.paper) === "playbook-closed"}
      livePlaybookClosed={
        firstSearchValue(params.paper) === "live-playbook-closed"
      }
      error={firstSearchValue(params.paperError)}
    />
  );
}
