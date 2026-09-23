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
  type TradingAccount,
} from "@/lib/accounts/model";
import { pinDeskSearchParam } from "@/lib/accounts/guard";
import { dcaDeskHasRunningPlaybook } from "@/lib/dca/store";
import { getSessionContext } from "@/lib/auth/session";
import { formatStrategyConnectionCaption } from "@/lib/exchanges/connections";
import { CopyDeskHeader } from "@/components/copy-desk-header";
import { HashScroll } from "@/components/hash-scroll";
import { loadCopyPaperLedger } from "@/lib/copy/balance";
import { copyPaperEquityView, type CopyPaperEquityView } from "@/lib/copy/decide";
import { loadAccountSnapshot } from "@/lib/exchanges/account-snapshot";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { accountCanHoldConnections, getVenue } from "@/lib/exchanges/venues";
import type { AutomationMode } from "@/lib/engine/decide";
import { futuresDeskAutomationStatus } from "@/lib/futures/automation";
import { loadFuturesNavModes } from "@/lib/futures/automation-load";
import { futuresPnlUsdt, markFromTicker } from "@/lib/futures/math";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { loadDeskTicker } from "@/lib/market/desk-tickers";
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

function navModes(flags: {
  anyLive: boolean;
  anyActive: boolean;
}): AutomationMode[] {
  if (flags.anyActive) {
    return ["active"];
  }
  if (flags.anyLive) {
    return ["reduce_only"];
  }
  return ["disabled"];
}

async function FuturesPaperMarks({
  nav,
  realizedUsdt,
  leverage,
  open,
  venue,
  venueEnvironment,
}: {
  nav: ComponentProps<typeof StrategySubnav>;
  realizedUsdt: number;
  leverage: number | null;
  open: Array<{
    symbol: string;
    side: "long" | "short";
    qty: number;
    entryPrice: number;
  }>;
  venue: string;
  venueEnvironment: string | null;
}) {
  const tickers = new Map<
    string,
    { lastPrice?: string; bid1Price?: string; ask1Price?: string }
  >();
  await Promise.all(
    [...new Set(open.map((row) => row.symbol))].map(async (symbol) => {
      try {
        const quote = await loadDeskTicker(venue, venueEnvironment, symbol);
        if (quote) {
          tickers.set(symbol, quote);
        }
      } catch {
        return;
      }
    }),
  );
  let unrealizedUsdt = 0;
  for (const row of open) {
    const mark = markFromTicker(tickers.get(row.symbol) ?? {});
    if (mark == null) {
      continue;
    }
    unrealizedUsdt += futuresPnlUsdt({
      side: row.side,
      qty: row.qty,
      entryPrice: row.entryPrice,
      exitPrice: mark,
    });
  }
  const paperBook: CopyPaperEquityView = copyPaperEquityView({
    realizedUsdt,
    unrealizedUsdt,
    leverage,
  });
  return <FuturesDeskNav {...nav} paperBook={paperBook} />;
}

async function FuturesDeskChrome({
  session,
}: {
  session: NonNullable<Awaited<ReturnType<typeof getSessionContext>>>;
}) {
  const deskType = session.account.deskType;
  const copyDesk = deskIsCopy(session.account);
  const signalFollower = deskType === "signal_follower" && !copyDesk;
  const dca = deskType === "dca" && !copyDesk;
  const perpsBots = deskType === "perps_bots" && !copyDesk;
  const live = accountCanHoldConnections(session.account.mode);
  const [settings, connections, dcaRunning, modes, ledger] = await Promise.all([
    loadFuturesSettings(),
    live
      ? listExchangeConnections(session.member.id)
      : Promise.resolve([]),
    dca
      ? dcaDeskHasRunningPlaybook(session.account.id)
      : Promise.resolve(false),
    dca
      ? Promise.resolve({ anyLive: false, anyActive: false })
      : loadFuturesNavModes(session.account.id),
    live
      ? Promise.resolve(null)
      : loadCopyPaperLedger({
          userId: session.member.id,
          accountId: session.account.id,
        }),
  ]);
  const bound =
    connections.find((row) => row.id === settings.connectionId) ?? null;
  const deskStatus = futuresDeskAutomationStatus({
    signedIn: true,
    modes: navModes(modes),
    reduceOnly: settings.reduceOnly,
    liveBook: live,
    bound: Boolean(bound),
  });
  const nav = futuresNavProps({
    account: session.account,
    automationsRunning: dca ? dcaRunning : deskStatus.automationsRunning,
    reduceOnly: deskStatus.reduceOnly,
    paperBook: ledger
      ? copyPaperEquityView({
          realizedUsdt: ledger.realizedUsdt,
          unrealizedUsdt: 0,
          leverage: settings.paperLeverage,
        })
      : null,
    live,
    bound,
    boundCaption: bound ? formatStrategyConnectionCaption(bound) : null,
    connectionsEmpty: connections.length === 0,
    connectionKnown: true,
    showIdentity: true,
  });
  const warning =
    live && !bound ? (
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
    ) : null;
  const navNode =
    live && bound ? (
      <Suspense fallback={<FuturesDeskNav {...nav} />}>
        <FuturesDeskNavLive
          userId={session.member.id}
          connectionId={bound.id}
          nav={nav}
        />
      </Suspense>
    ) : ledger && ledger.open.length > 0 ? (
      <Suspense fallback={<FuturesDeskNav {...nav} />}>
        <FuturesPaperMarks
          nav={nav}
          realizedUsdt={ledger.realizedUsdt}
          leverage={settings.paperLeverage}
          open={ledger.open}
          venue={session.account.venue}
          venueEnvironment={session.account.venueEnvironment}
        />
      </Suspense>
    ) : (
      <FuturesDeskNav {...nav} />
    );
  return (
    <>
      {navNode}
      {warning}
    </>
  );
}

function futuresNavProps(input: {
  account: TradingAccount | null;
  automationsRunning?: boolean;
  reduceOnly?: boolean;
  paperBook?: CopyPaperEquityView | null;
  live?: boolean;
  bound?: {
    id: string;
  } | null;
  connectionsEmpty?: boolean;
  boundCaption?: ReturnType<typeof formatStrategyConnectionCaption> | null;
  connectionKnown?: boolean;
  showIdentity?: boolean;
}): ComponentProps<typeof StrategySubnav> {
  const account = input.account;
  const deskType = account?.deskType ?? "perps";
  const copyDesk = account ? deskIsCopy(account) : false;
  const venueLabel = (account ? getVenue(account.venue)?.label : null) ?? "Bybit";
  const signalFollower = deskType === "signal_follower" && !copyDesk;
  const perpsBots = deskType === "perps_bots" && !copyDesk;
  const manualPerps = deskType === "perps" && !copyDesk;
  const deskId = account?.id ?? null;
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
  const live = Boolean(input.live);
  const caption = input.bound ? input.boundCaption : null;
  return {
    title: account?.name ?? formatDeskType(deskType),
    typeLabel: account && !copyDesk ? formatDeskType(deskType) : undefined,
    identity:
      input.showIdentity && copyDesk && account ? (
        <CopyDeskHeader
          account={account}
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
      copyDesk || signalFollower || manualPerps
        ? false
        : Boolean(input.automationsRunning),
    reduceOnly: Boolean(input.reduceOnly),
    paperBook: input.paperBook ?? null,
    connection: live
      ? input.bound && caption
        ? {
            ...caption,
            connected: true,
          }
        : input.connectionKnown
          ? {
              name: "Connect an exchange",
              venue: null,
              connected: false,
              href: input.connectionsEmpty
                ? "/account/sub-accounts?tab=exchanges"
                : settingsHref,
            }
          : {
              name: account ? formatDeskVenueCaption(account) : venueLabel,
              venue: null,
              connected: true,
              overline: "Market Data",
            }
      : {
          name: account ? formatDeskVenueCaption(account) : venueLabel,
          venue: null,
          connected: true,
          overline: "Market Data",
        },
  };
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
  const shell = futuresNavProps({
    account: session?.account ?? null,
    live: Boolean(session && accountCanHoldConnections(session.account.mode)),
    connectionsEmpty: true,
  });
  return (
    <div>
      {session ? (
        <Suspense fallback={<FuturesDeskNav {...shell} />}>
          <FuturesDeskChrome session={session} />
        </Suspense>
      ) : (
        <FuturesDeskNav {...shell} />
      )}
      <HashScroll />
      {children}
    </div>
  );
}
