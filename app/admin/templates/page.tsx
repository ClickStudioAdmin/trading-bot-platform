import type { Metadata } from "next";
import { TemplatesLibrary } from "@/components/templates-library";
import { parseLibraryTab } from "@/lib/templates/library-tab";
import { getSessionMember } from "@/lib/auth/session";
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

  return (
    <TemplatesLibrary
      variant="admin"
      overline="Admin"
      title="Templates"
      description="Platform templates and folders are visible to every member. Edit, unpublish, or export this catalog here. Add a platform row with Save as platform template from Automations or a finished backtest. Member libraries stay on Account / Templates."
      templates={templates}
      sets={sets}
      initialTab={parseLibraryTab(params.tab)}
    />
  );
}
