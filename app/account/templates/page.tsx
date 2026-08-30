import type { Metadata } from "next";
import { TemplatesLibrary } from "@/components/templates-library";
import { parseLibraryTab } from "@/lib/templates/library-tab";
import { getSessionMember } from "@/lib/auth/session";
import { listLinkedBacktestRuns } from "@/lib/backtest/store";
import { listSharedSets, listSharedTemplates, listVisibleSets, listVisibleTemplates } from "@/lib/templates/store";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Bot Templates",
  description: "Your automation templates and folders.",
};

export default async function AccountTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const [templates, sets, sharedTemplates, sharedSets] = await Promise.all([
    listVisibleTemplates({ userId: member.id }),
    listVisibleSets({ userId: member.id }),
    listSharedTemplates({ userId: member.id }),
    listSharedSets({ userId: member.id }),
  ]);
  const linkedBacktests = await listLinkedBacktestRuns(
    templates.map((row) => row.id),
  );

  return (
    <TemplatesLibrary
      variant="account"
      title="Bot Templates"
      description="Your templates. Add a platform or personal template to a matching desk from Automations. A Backtest link appears after you save a finished run to that template. Publish snapshot stays on Backtests, not here."
      templates={templates}
      sets={sets}
      sharedTemplates={sharedTemplates}
      sharedSets={sharedSets}
      linkedBacktests={linkedBacktests}
      initialTab={parseLibraryTab(params.tab)}
    />
  );
}
