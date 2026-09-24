import type { Metadata } from "next";
import Link from "next/link";
import { DeskBlotterScopeSelect } from "@/components/desk-blotter-filters";
import { DeskReturnHeading } from "@/components/desk-return-heading";
import { EventLogs } from "@/components/event-logs";
import {
  CASH_AND_CARRY_ACTIVITY_PATH,
  CASH_AND_CARRY_AUTOMATIONS_PATH,
  automationsBotReturn,
  automationsReturnHref,
} from "@/lib/bots/automations-path";
import { getSessionContext } from "@/lib/auth/session";
import {
  listEventLogs,
  parseEventLogFilters,
  withoutDuplicateFillLogs,
} from "@/lib/logs/list";
import { listPaperBotOptions } from "@/lib/paper/list";

export const metadata: Metadata = {
  title: "Activity",
  description: "Your manual and automated paper activity.",
};

export default async function CashAndCarryActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  const filters = parseEventLogFilters(params);
  const [rows, bots] = await Promise.all([
    session
      ? listEventLogs(filters, { accountId: session.account.id })
      : Promise.resolve([]),
    session ? listPaperBotOptions() : Promise.resolve([]),
  ]);
  const visible = withoutDuplicateFillLogs(rows);
  const botReturn = automationsBotReturn(
    params,
    bots,
    filters.bot ?? "",
    CASH_AND_CARRY_AUTOMATIONS_PATH,
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
      {session ? (
        <EventLogs
          rows={visible}
          filters={filters}
          clearHref={automationsReturnHref(
            CASH_AND_CARRY_ACTIVITY_PATH,
            session.account.id,
            botReturn.keep,
          )}
          showUser={false}
          scopes={["strategy", "trade"]}
          hidden={{ desk: session.account.id }}
          keep={botReturn.keep}
        />
      ) : (
        <p className="text-sm text-ink-muted">
          <Link href="/sign-in" className="text-accent">
            Sign in
          </Link>{" "}
          to see your manual and automated activity.
        </p>
      )}
    </main>
  );
}
