import type { Metadata } from "next";
import { MembershipPlanCards } from "@/components/membership-plan-cards";
import { PageHeading } from "@/components/page-heading";
import { getSessionMember } from "@/lib/auth/session";
import { publicCatalogPlans } from "@/lib/membership/catalog";
import {
  getMemberPlanId,
  listMembershipPlans,
} from "@/lib/membership/store";
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
  const plans = listed.ok ? publicCatalogPlans(listed.plans) : [];

  return (
    <div>
      <PageHeading title="Plans" />
      <p className="-mt-4 max-w-2xl text-sm text-ink-muted">
        One subscription per login. Features you do not have stay visible in
        the app and stay disabled until you upgrade. Card checkout is the next
        step.
      </p>
      {!listed.ok ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {listed.error}
        </p>
      ) : null}
      <MembershipPlanCards plans={plans} currentPlanId={currentPlanId} />
    </div>
  );
}
