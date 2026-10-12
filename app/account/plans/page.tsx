import type { Metadata } from "next";
import { MembershipPlanCards } from "@/components/membership-plan-cards";
import { PageHeading } from "@/components/page-heading";
import { getSessionMember } from "@/lib/auth/session";
import { publicCatalogPlans } from "@/lib/membership/catalog";
import {
  getMemberPlanId,
  listMembershipPlans,
} from "@/lib/membership/store";
import { ensureMemberTrialGrants } from "@/lib/membership/trial-store";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Plans",
  description: "Membership plans and what each one includes.",
};

export default async function AccountPlansPage() {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const [listed, currentPlanId] = await Promise.all([
    listMembershipPlans(),
    getMemberPlanId(member.id),
  ]);
  const plans = listed.ok
    ? publicCatalogPlans(listed.plans, {
        currentPlanId,
        includePreviewDrafts: member.role === "admin",
      })
    : [];
  const current = currentPlanId
    ? plans.find((plan) => plan.id === currentPlanId) ?? null
    : null;
  const granted = current
    ? await ensureMemberTrialGrants({
        userId: member.id,
        plan: current,
      })
    : null;
  return (
    <div>
      <PageHeading title="Plans" />
      {!listed.ok ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {listed.error}
        </p>
      ) : null}
      <MembershipPlanCards
        plans={plans}
        currentPlanId={currentPlanId}
        checkout
        trialGrants={granted?.ok ? granted.grants : []}
        nowMs={granted?.ok ? granted.nowMs : 0}
      />
    </div>
  );
}
