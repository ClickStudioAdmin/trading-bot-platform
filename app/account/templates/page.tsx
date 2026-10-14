import type { Metadata } from "next";
import { TemplatesLibrary } from "@/components/templates-library";
import { memberIsAdmin } from "@/lib/admin/access";
import { parseLibraryTab } from "@/lib/templates/library-tab";
import { firstSearchValue } from "@/lib/paper/open";
import { getSessionMember } from "@/lib/auth/session";
import { inheritPlatformBacktests } from "@/lib/backtest/library";
import { listLinkedBacktestRuns } from "@/lib/backtest/store";
import { listTemplateBotLinks } from "@/lib/templates/desk-bots-load";
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
  const libraryRows = [...templates, ...sharedTemplates];
  const [linkedRuns, botLinks] = await Promise.all([
    listLinkedBacktestRuns(
      libraryRows.map((row) => row.id),
      { userId: member.id, isAdmin: memberIsAdmin(member) },
    ),
    listTemplateBotLinks(member.id, libraryRows),
  ]);
  const linkedBacktests = inheritPlatformBacktests(libraryRows, linkedRuns);

  return (
    <TemplatesLibrary
      variant="account"
      title="Bot Templates"
      templates={templates}
      sets={sets}
      sharedTemplates={sharedTemplates}
      sharedSets={sharedSets}
      linkedBacktests={linkedBacktests}
      botLinks={botLinks}
      initialTab={parseLibraryTab(params.tab)}
      focusTemplateId={firstSearchValue(params.template)?.trim() || null}
    />
  );
}
