import type { Metadata } from "next";
import Link from "next/link";
import { DeskBlotterScopeSelect } from "@/components/desk-blotter-filters";
import { DeskReturnHeading } from "@/components/desk-return-heading";
import { EventLogs } from "@/components/event-logs";
import { deskIsCopy, deskShowsDcaBlotter } from "@/lib/accounts/model";
import {
  automationsBotReturn,
  automationsReturnHref,
} from "@/lib/bots/automations-path";
import { getSessionContext } from "@/lib/auth/session";
import { listDcaBotOptions } from "@/lib/dca/store";
import { listFuturesAutomationRuleOptions } from "@/lib/futures/automation-load";
import {
  listEventLogs,
  parseEventLogFilters,
  withoutDuplicateFillLogs,
} from "@/lib/logs/list";
import { FUTURES_PATHS, FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";

export const metadata: Metadata = {
  title: "Activity",
  description: "Your manual and automated futures activity.",
};

export default async function FuturesActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  const deskType = session?.account.deskType ?? "perps";
  const copyDesk = session ? deskIsCopy(session.account) : false;
  const filters = parseEventLogFilters(params);
  const dcaBlotter = session
    ? deskShowsDcaBlotter(session.account)
    : deskType === "dca";
  const recipeAccountId = copyDesk
    ? session?.account.copyOfAccountId
    : session?.account.id;
  const [rows, botOptions, perpsBots] = await Promise.all([
    session
      ? listEventLogs(filters, { accountId: session.account.id })
      : Promise.resolve([]),
    dcaBlotter && recipeAccountId && !copyDesk
      ? listDcaBotOptions(recipeAccountId)
      : Promise.resolve([]),
    deskType === "perps_bots" && recipeAccountId && !copyDesk
      ? listFuturesAutomationRuleOptions(recipeAccountId)
      : Promise.resolve([]),
  ]);
  const visible = withoutDuplicateFillLogs(rows).filter(
    (row) => row.strategy === FUTURES_STRATEGY_ID,
  );
  const bots = dcaBlotter ? botOptions : perpsBots;
  const botReturn = automationsBotReturn(
    params,
    bots,
    filters.bot ?? "",
    FUTURES_PATHS.automations,
    session?.account.id,
  );
  const scopeKeep = {
    ...botReturn.keep,
    ...(filters.scope ? { scope: filters.scope } : {}),
    ...(filters.level ? { level: filters.level } : {}),
    ...(filters.event ? { event: filters.event } : {}),
  };

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      {session ? (
        <DeskReturnHeading
          title={botReturn.titleFor("Activity")}
          backHref={botReturn.backHref}
          className="mb-0"
          actions={
            <DeskBlotterScopeSelect
              values={{ bot: filters.bot ?? "", pair: "", side: "" }}
              bots={bots}
              deskId={session.account.id}
              keep={scopeKeep}
            />
          }
        />
      ) : (
        <h2 className="mb-6 text-lg font-semibold tracking-tight">Activity</h2>
      )}
      {copyDesk ? (
        <p className="mt-4 text-sm text-ink-muted">
          Parent and copy events for this desk: followed, paused, resumed,
          copied fills and limits, amends and cancels to match the parent, and
          skipped trades (parent already in that trade, book too small, paused,
          reduce-only, adverse move, and the rest).
        </p>
      ) : null}
      {session ? (
        <EventLogs
          rows={visible}
          filters={filters}
          clearHref={automationsReturnHref(
            FUTURES_PATHS.activity,
            session.account.id,
            botReturn.keep,
          )}
          showUser={false}
          scopes={["strategy", "trade"]}
          hidden={{ desk: session.account.id }}
          keep={botReturn.keep}
          bots={bots}
        />
      ) : (
        <p className="text-sm text-ink-muted">
          <Link href="/sign-in" className="text-accent">
            Sign in
          </Link>{" "}
          to see your futures activity.
        </p>
      )}
    </main>
  );
}
