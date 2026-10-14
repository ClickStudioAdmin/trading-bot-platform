import type { Metadata } from "next";
import { TemplatesLibrary } from "@/components/templates-library";
import { memberIsAdmin } from "@/lib/admin/access";
import { parseLibraryTab } from "@/lib/templates/library-tab";
import { getSessionMember } from "@/lib/auth/session";
import { listLinkedBacktestRuns } from "@/lib/backtest/store";
import { listAllSets, listAllTemplates } from "@/lib/templates/store";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Templates",
  description: "Platform automation templates and folders.",
};

export default async function AdminTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const [templates, sets] = await Promise.all([
    listAllTemplates({ visibility: "platform" }),
    listAllSets({ visibility: "platform" }),
  ]);
  const linkedBacktests = await listLinkedBacktestRuns(
    templates.map((row) => row.id),
    { userId: member.id, isAdmin: memberIsAdmin(member) },
  );

  return (
    <TemplatesLibrary
      variant="admin"
      overline="Admin"
      title="Templates"
      templates={templates}
      sets={sets}
      linkedBacktests={linkedBacktests}
      initialTab={parseLibraryTab(params.tab)}
    />
  );
}
