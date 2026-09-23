import { Suspense, type ComponentProps } from "react";
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
import { dcaDeskHasRunningPlaybook } from "@/lib/dca/store";
import { getSessionContext } from "@/lib/auth/session";
import { formatStrategyConnectionCaption } from "@/lib/exchanges/connections";
import { CopyDeskHeader } from "@/components/copy-desk-header";
import { HashScroll } from "@/components/hash-scroll";
import { loadCopyPaperEquityView } from "@/lib/copy/balance";
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

function FuturesDeskNav(props: ComponentProps<typeof StrategySubnav>) {
  return <StrategySubnav {...props} />;
}

async function FuturesDeskNavLive({
  userId,
  connectionId,
  nav,
}: {
  userId: string;
  connectionId: string;
  nav: ComponentProps<typeof StrategySubnav>;
}) {
  const snapshot = await loadAccountSnapshot(userId, connectionId);
  return (
    <FuturesDeskNav
      {...nav}
      connection={
        nav.connection ? { ...nav.connection, snapshot } : nav.connection
      }
    />
  );
}

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
  const venueLabel =
    (session ? getVenue(session.account.venue)?.label : null) ?? "Bybit";
  const signalFollower = deskType === "signal_follower" && !copyDesk;
  const dca = deskType === "dca" && !copyDesk;
  const perpsBots = deskType === "perps_bots" && !copyDesk;
  const manualPerps = deskType === "perps" && !copyDesk;
  const live = Boolean(session && accountCanHoldConnections(session.account.mode));
  const [settings, rules, connections, paperBook, dcaRunning] = await Promise.all([
    session ? loadFuturesSettings() : Promise.resolve(null),
    session
      ? loadFuturesAutomationRules(session.account.id)
      : Promise.resolve([]),
    live && session
      ? listExchangeConnections(session.member.id)
      : Promise.resolve([]),
    !live && session
      ? loadCopyPaperEquityView({
          userId: session.member.id,
          accountId: session.account.id,
          venue: session.account.venue,
          venueEnvironment: session.account.venueEnvironment,
        })
      : Promise.resolve(null),
    dca && session
      ? dcaDeskHasRunningPlaybook(session.account.id)
      : Promise.resolve(false),
  ]);
  const bound =
    connections.find((row) => row.id === settings?.connectionId) ?? null;
  const deskStatus = futuresDeskAutomationStatus({
    signedIn: Boolean(session),
    modes: rules.map((rule) => rule.mode),
    reduceOnly: Boolean(settings?.reduceOnly),
    liveBook: live,
    bound: Boolean(bound),
  });
  const automationsRunning = dca ? dcaRunning : deskStatus.automationsRunning;
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
    ? FUTURES_SECONDARY_LINKS.filter((link) => link.href !== FUTURES_PATHS.shared)
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
  const navProps: ComponentProps<typeof StrategySubnav> = {
    title: session?.account.name ?? formatDeskType(deskType),
    typeLabel: session && !copyDesk ? formatDeskType(deskType) : undefined,
    identity:
      copyDesk && session ? (
        <CopyDeskHeader
          account={session.account}
          next={
            deskId
              ? pathWithDesk(FUTURES_PATHS.positions, deskId)
              : FUTURES_PATHS.positions
          }
        />
      ) : undefined,
    navLabel: formatDeskType(deskType),
    primaryLinks,
    secondaryLinks,
    automationsHref,
    automationsRunning:
      copyDesk || signalFollower || manualPerps ? false : automationsRunning,
    reduceOnly: deskStatus.reduceOnly,
    paperBook,
    connection: live
      ? bound
        ? {
            ...formatStrategyConnectionCaption(bound),
            connected: true,
          }
        : {
            name: "Connect an exchange",
            venue: null,
            connected: false,
            href:
              connections.length === 0
                ? "/account/sub-accounts?tab=exchanges"
                : settingsHref,
          }
      : {
          name: session ? formatDeskVenueCaption(session.account) : venueLabel,
          venue: null,
          connected: true,
          overline: "Market Data",
        },
  };
  const nav =
    live && session && bound ? (
      <Suspense fallback={<FuturesDeskNav {...navProps} />}>
        <FuturesDeskNavLive
          userId={session.member.id}
          connectionId={bound.id}
          nav={navProps}
        />
      </Suspense>
    ) : (
      <FuturesDeskNav {...navProps} />
    );
  return (
    <div>
      {nav}
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
      <HashScroll />
      {children}
    </div>
  );
}
