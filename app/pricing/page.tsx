import type { Metadata } from "next";
import { MembershipPlanCards } from "@/components/membership-plan-cards";
import { PageHeading } from "@/components/page-heading";
import { publicCatalogPlans } from "@/lib/membership/catalog";
import { listMembershipPlans } from "@/lib/membership/store";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Public membership plans and what each one includes.",
};

export default async function PricingPage() {
  const listed = await listMembershipPlans();
  const plans = listed.ok ? publicCatalogPlans(listed.plans) : [];

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <PageHeading title="Pricing" />
      <p className="-mt-4 max-w-2xl text-sm text-ink-muted">
        Public plans only. Sign in to see a private or assigned plan on Plans
        in the app.
      </p>
      {!listed.ok ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {listed.error}
        </p>
      ) : null}
      <MembershipPlanCards plans={plans} currentPlanId={null} />
    </main>
  );
}
