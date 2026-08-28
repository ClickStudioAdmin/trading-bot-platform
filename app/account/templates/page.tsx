import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { TemplatesLibrary } from "@/components/templates-library";
import { getSessionMember } from "@/lib/auth/session";
import { listTradingAccounts } from "@/lib/accounts/store";
import { listVisibleSets, listVisibleTemplates } from "@/lib/templates/store";
import type { TemplateDeskType } from "@/lib/templates/recipe";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Templates",
  description: "Your automation templates and sets.",
};

export default async function AccountTemplatesPage() {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const [templates, sets, accounts] = await Promise.all([
    listVisibleTemplates({ userId: member.id }),
    listVisibleSets({ userId: member.id }),
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
      <PageHeading title="Templates" />
      <p className="-mt-4 text-sm text-ink-muted">
        Your recipes and platform recipes. Apply them to a matching desk as
        idle or disabled automations.
      </p>
      <TemplatesLibrary
        variant="account"
        templates={templates}
        sets={sets}
        desks={desks}
      />
    </div>
  );
}
