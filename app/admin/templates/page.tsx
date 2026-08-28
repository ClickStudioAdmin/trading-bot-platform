import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { TemplatesLibrary } from "@/components/templates-library";
import { getSessionMember } from "@/lib/auth/session";
import { listTradingAccounts } from "@/lib/accounts/store";
import { listAllSets, listAllTemplates } from "@/lib/templates/store";
import type { TemplateDeskType } from "@/lib/templates/recipe";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Templates",
  description: "Platform and member automation templates.",
};

export default async function AdminTemplatesPage() {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const [templates, sets, accounts] = await Promise.all([
    listAllTemplates(),
    listAllSets(),
    listTradingAccounts(member.id),
  ]);
  const desks = accounts
    .filter(
      (
        desk,
      ): desk is typeof desk & { deskType: TemplateDeskType } =>
        desk.deskType === "dca" ||
        desk.deskType === "perps" ||
        desk.deskType === "cash_and_carry",
    )
    .map((desk) => ({
      id: desk.id,
      name: desk.name,
      deskType: desk.deskType,
    }));

  return (
    <div>
      <PageHeading overline="Admin" title="Templates" />
      <p className="-mt-4 text-sm text-ink-muted">
        Platform templates are visible to every member. User templates can
        be renamed, deleted, or published as a platform copy. Apply to your
        own desks from Automations or Account → Templates.
      </p>
      <TemplatesLibrary
        variant="admin"
        templates={templates}
        sets={sets}
        desks={desks}
      />
    </div>
  );
}
