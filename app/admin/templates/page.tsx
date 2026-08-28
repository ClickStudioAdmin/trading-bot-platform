import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { TemplatesLibrary } from "@/components/templates-library";
import { parseLibraryTab } from "@/lib/templates/library-tab";
import { getSessionMember } from "@/lib/auth/session";
import { listAllSets, listAllTemplates, listSharedSets, listSharedTemplates } from "@/lib/templates/store";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Templates",
  description: "Platform and member automation templates.",
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
  const [templates, sets, sharedTemplates, sharedSets] = await Promise.all([
    listAllTemplates(),
    listAllSets(),
    listSharedTemplates({ userId: member.id }),
    listSharedSets({ userId: member.id }),
  ]);

  return (
    <div>
      <PageHeading overline="Admin" title="Templates" />
      <p className="-mt-4 text-sm text-ink-muted">
        Platform templates are visible to every member. User templates can
        be renamed, deleted, or published as a platform copy. Export all
        libraries, import copies into yours, or share a user template or
        folder by email. Add them to a desk from Automations.
      </p>
      <TemplatesLibrary
        variant="admin"
        templates={templates}
        sets={sets}
        sharedTemplates={sharedTemplates}
        sharedSets={sharedSets}
        initialTab={parseLibraryTab(params.tab)}
      />
    </div>
  );
}
