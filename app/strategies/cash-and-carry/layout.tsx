import { Suspense, type ComponentProps } from "react";
import { StrategySubnav } from "@/components/strategy-subnav";
import {
  deskHomePath,
  deskUsesCashAndCarry,
  formatDeskType,
  formatDeskVenueCaption,
  navLinksWithDesk,
  pathWithDesk,
} from "@/lib/accounts/model";
import { pinDeskSearchParam } from "@/lib/accounts/guard";
import { getSessionContext } from "@/lib/auth/session";
import { loadCashAndCarryNavModes } from "@/lib/engine/load";
import { loadEngineSettings } from "@/lib/engine/settings";
import { formatStrategyConnectionCaption } from "@/lib/exchanges/connections";
import { loadAccountSnapshot } from "@/lib/exchanges/account-snapshot";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import {
  CASH_AND_CARRY_PRIMARY_LINKS,
  CASH_AND_CARRY_SECONDARY_LINKS,
} from "@/lib/site-links";
import { redirect } from "next/navigation";

function CashAndCarryNav(props: ComponentProps<typeof StrategySubnav>) {
  return <StrategySubnav {...props} />;
}

async function CashAndCarryNavLive({
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
    <CashAndCarryNav
      {...nav}
      connection={
        nav.connection ? { ...nav.connection, snapshot } : nav.connection
      }
    />
  );
}

export default async function CashAndCarryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionContext();
  if (session && !deskUsesCashAndCarry(session.account.deskType)) {
    redirect(deskHomePath(session.account, session.account.id));
  }
  if (session) {
    await pinDeskSearchParam(session);
  }
  const deskId = session?.account.id ?? null;
  const settingsHref = deskId
    ? pathWithDesk("/strategies/cash-and-carry/settings", deskId)
    : "/strategies/cash-and-carry/settings";
  const live = Boolean(session && accountCanHoldConnections(session.account.mode));
  const [modes, settings, connections] = await Promise.all([
    session
      ? loadCashAndCarryNavModes(session.account.id)
      : Promise.resolve({ anyLive: false, anyActive: false }),
    session ? loadEngineSettings() : Promise.resolve(null),
    live && session
      ? listExchangeConnections(session.member.id)
      : Promise.resolve([]),
  ]);
  const bound =
    connections.find((row) => row.id === settings?.connectionId) ?? null;
  const anyActive = modes.anyActive;
  const anyLive = modes.anyLive;
  const accountReduce = Boolean(settings?.reduceOnly);
  const automationsOn = Boolean(session) && anyLive;
  const engineRunning =
    automationsOn &&
    anyActive &&
    !accountReduce &&
    (!live || Boolean(bound));
  const navProps: ComponentProps<typeof StrategySubnav> = {
    title: session?.account.name ?? "Cash and Carry",
    typeLabel: session ? formatDeskType("cash_and_carry") : undefined,
    primaryLinks: deskId
      ? navLinksWithDesk(CASH_AND_CARRY_PRIMARY_LINKS, deskId)
      : CASH_AND_CARRY_PRIMARY_LINKS,
    secondaryLinks: deskId
      ? navLinksWithDesk(CASH_AND_CARRY_SECONDARY_LINKS, deskId)
      : CASH_AND_CARRY_SECONDARY_LINKS,
    automationsHref: deskId
      ? pathWithDesk("/strategies/cash-and-carry/automations", deskId)
      : "/strategies/cash-and-carry/automations",
    automationsRunning: engineRunning,
    reduceOnly: automationsOn && (accountReduce || !anyActive),
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
          name: session ? formatDeskVenueCaption(session.account) : "Bybit",
          venue: null,
          connected: true,
          href: settingsHref,
          overline: "Market Data",
        },
  };
  const nav =
    live && session && bound ? (
      <Suspense fallback={<CashAndCarryNav {...navProps} />}>
        <CashAndCarryNavLive
          userId={session.member.id}
          connectionId={bound.id}
          nav={navProps}
        />
      </Suspense>
    ) : (
      <CashAndCarryNav {...navProps} />
    );
  return (
    <div>
      {nav}
      {live && !bound ? (
        <div className="mx-auto max-w-7xl px-6 pt-4">
          <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            This is a Connected Exchange desk. Bind an exchange in Desk
            Settings before Open, Close, Unwind, or automations can place
            orders.
          </p>
        </div>
      ) : null}
      {children}
    </div>
  );
}
