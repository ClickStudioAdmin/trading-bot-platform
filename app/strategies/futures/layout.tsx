import { StrategySubnav } from "@/components/strategy-subnav";
import {
  deskHomePath,
  deskIsCopy,
  deskUsesPerpsUi,
  formatDeskType,
  formatDeskVenueCaption,
  navLinksWithDesk,
  pathWithDesk,
} from "@/lib/accounts/model";
import { pinDeskSearchParam } from "@/lib/accounts/guard";
import { dcaPlaybookIsRunning } from "@/lib/dca/playbook";
import { listDcaPlaybooksForAccount } from "@/lib/dca/store";
import { getSessionContext } from "@/lib/auth/session";
import { formatStrategyConnectionCaption } from "@/lib/exchanges/connections";
import { loadAccountSnapshot } from "@/lib/exchanges/account-snapshot";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { accountCanHoldConnections, getVenue } from "@/lib/exchanges/venues";
import { futuresDeskAutomationStatus } from "@/lib/futures/automation";
import { loadFuturesAutomationRules } from "@/lib/futures/automation-load";
import { loadFuturesSettings } from "@/lib/futures/settings";
import {
  COPY_PRIMARY_LINKS,
  FUTURES_PRIMARY_LINKS,
  FUTURES_SECONDARY_LINKS,
  PERPS_BOTS_PRIMARY_LINKS,
  PERPS_PRIMARY_LINKS,
  SIGNAL_FOLLOWER_PRIMARY_LINKS,
} from "@/lib/site-links";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { redirect } from "next/navigation";

export default async function FuturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionContext();
  if (session && !deskUsesPerpsUi(session.account.deskType)) {
    redirect(deskHomePath(session.account.deskType, session.account.id));
  }
  if (session) {
    await pinDeskSearchParam(session);
  }
  const deskType = session?.account.deskType ?? "perps";
  const copyDesk = session ? deskIsCopy(session.account) : false;
  const hyperliquid = session?.account.venue === "hyperliquid";
  const venueLabel =
    (session ? getVenue(session.account.venue)?.label : null) ?? "Bybit";
  const signalFollower = deskType === "signal_follower" && !copyDesk;
  const dca = deskType === "dca" && !copyDesk;
  const perpsBots = deskType === "perps_bots" && !copyDesk;
  const manualPerps = deskType === "perps" && !copyDesk;
  const live = Boolean(session && accountCanHoldConnections(session.account.mode));
  const settings = session ? await loadFuturesSettings() : null;
  const rules = session
    ? await loadFuturesAutomationRules(session.account.id)
    : [];
  const connections =
    live && session
      ? await listExchangeConnections(session.member.id)
      : [];
  const bound =
    connections.find((row) => row.id === settings?.connectionId) ?? null;
  const snapshot =
    live && session && bound
      ? await loadAccountSnapshot(
          session.member.id,
          bound.id,
        )
      : null;
  const playbooks =
    dca && session
      ? await listDcaPlaybooksForAccount(session.account.id)
      : [];
  const deskStatus = futuresDeskAutomationStatus({
    signedIn: Boolean(session),
    modes: rules.map((rule) => rule.mode),
    reduceOnly: Boolean(settings?.reduceOnly),
    liveBook: live,
    bound: Boolean(bound),
  });
  const automationsRunning = dca
    ? playbooks.some((playbook) => dcaPlaybookIsRunning(playbook))
    : deskStatus.automationsRunning;
  const deskId = session?.account.id ?? null;
  const primaryBase = copyDesk
    ? COPY_PRIMARY_LINKS
    : signalFollower
      ? SIGNAL_FOLLOWER_PRIMARY_LINKS
      : perpsBots
        ? PERPS_BOTS_PRIMARY_LINKS
        : manualPerps
          ? PERPS_PRIMARY_LINKS
          : FUTURES_PRIMARY_LINKS;
  const primaryLinks = deskId
    ? navLinksWithDesk(primaryBase, deskId)
    : primaryBase;
  const secondaryBase = copyDesk
    ? FUTURES_SECONDARY_LINKS.filter(
        (link) =>
          link.href !== FUTURES_PATHS.shared &&
          link.href !== FUTURES_PATHS.pairs,
      )
    : FUTURES_SECONDARY_LINKS;
  const secondaryLinks = deskId
    ? navLinksWithDesk(secondaryBase, deskId)
    : secondaryBase;
  const settingsHref = deskId
    ? pathWithDesk(FUTURES_PATHS.settings, deskId)
    : FUTURES_PATHS.settings;
  const automationsHref = deskId
    ? pathWithDesk(
        signalFollower ? FUTURES_PATHS.settings : FUTURES_PATHS.automations,
        deskId,
      )
    : signalFollower
      ? FUTURES_PATHS.settings
      : FUTURES_PATHS.automations;
  return (
    <div>
      <StrategySubnav
        title={session?.account.name ?? formatDeskType(deskType)}
        typeLabel={
          session
            ? copyDesk
              ? `${formatDeskType(deskType)} · Copy`
              : formatDeskType(deskType)
            : undefined
        }
        description={
          copyDesk
            ? "This desk copies another trader. Sizing, reduce-only, max daily loss, and Close All still protect. Pause or unfollow in Desk Settings. No ticket, bots, or webhooks."
            : signalFollower
            ? "TradingView sends buy, sell, and close. This desk only protects: caps, reduce-only, Close All, and row TP/SL."
            : dca
              ? hyperliquid
                ? "This desk owns orders and exits. One open side per coin. Both is not available. Arm from Automations or a Signal webhook."
                : "This desk owns orders and exits. Arm from Automations or a Signal webhook. Close All & Cancel All Open Orders is the panic flatten. Change TP/SL on Automations."
              : perpsBots
                ? "Automations own buy, sell, and close. Arm from Automations or a Signal webhook. No ticket. Close All still flattens."
                : hyperliquid
                  ? "Buy, sell, or close one USDC perpetual. Market or limit. One open side per coin. No bots on this desk."
                  : "Buy, sell, or close one USDT linear perpetual. Market or limit. Long and short can both be open. No bots on this desk."
        }
        navLabel={formatDeskType(deskType)}
        primaryLinks={primaryLinks}
        secondaryLinks={secondaryLinks}
        automationsHref={automationsHref}
        automationsRunning={
          copyDesk || signalFollower || manualPerps ? false : automationsRunning
        }
        reduceOnly={deskStatus.reduceOnly}
        connection={
          live
            ? bound
              ? {
                  ...formatStrategyConnectionCaption(bound),
                  connected: true,
                  snapshot,
                }
              : {
                  name: "Connect an exchange",
                  venue: null,
                  connected: false,
                  href:
                    connections.length === 0
                      ? "/account/exchanges"
                      : settingsHref,
                }
            : {
                name: session
                  ? formatDeskVenueCaption(session.account)
                  : venueLabel,
                venue: null,
                connected: true,
                href: settingsHref,
                overline: "Market Data",
              }
        }
      />
      {live && !bound ? (
        <div className="mx-auto max-w-7xl px-6 pt-4">
          <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            This is a Connected Exchange desk. Bind an exchange in Desk
            Settings before{" "}
            {copyDesk
              ? "copied fills can place."
              : signalFollower
                ? "TradingView orders can place."
                : dca || perpsBots
                  ? "the bot can place."
                  : "Buy, Sell, or Close can place orders."}
          </p>
        </div>
      ) : null}
      {children}
    </div>
  );
}
