import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { AffiliateDashboard } from "@/components/affiliate-dashboard";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getSessionMember } from "@/lib/auth/session";
import {
  parseAffiliatePortalTab,
  referralShareUrl,
} from "@/lib/membership/affiliate";
import { signUpAffiliateAction } from "@/lib/membership/affiliate-actions";
import {
  listMemberPayouts,
  loadAffiliatePortal,
  loadMemberArrears,
} from "@/lib/membership/affiliate-store";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import { listBillingChains } from "@/lib/membership/wallet-store";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "Affiliates",
  description: "Promote the platform and earn on referred subscriptions.",
};

export default async function AffiliatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await getSessionMember();
  const params = await searchParams;
  const error = firstSearchValue(params.error);
  const saved = firstSearchValue(params.saved);
  const tab = parseAffiliatePortalTab(firstSearchValue(params.tab));
  const referralCode =
    firstSearchValue(params.ref) ?? firstSearchValue(params.referralCode) ?? "";

  if (member) {
    const arrears = await loadMemberArrears(member.id);
    const portal = await loadAffiliatePortal(member.id);
    const headerStore = await headers();
    const host =
      headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "";
    const proto = headerStore.get("x-forwarded-proto") ?? "http";
    const origin = host ? `${proto}://${host}` : "";
    const shareUrl =
      portal.code && origin ? referralShareUrl(origin, portal.code) : "";
    const [payouts, chains] = await Promise.all([
      listMemberPayouts(member.id),
      listBillingChains(),
    ]);
    return (
      <main className="mx-auto max-w-7xl px-6 py-12">
        <AffiliateDashboard
          portal={portal}
          shareUrl={shareUrl}
          arrears={arrears}
          payouts={payouts}
          chains={chains}
          platformMember={member.platformMember}
          tab={tab}
          saved={saved}
          error={error}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:items-start">
        <div>
          <PageHeading overline="Program" title="Affiliates" />
          <p className="-mt-4 max-w-2xl text-sm text-ink-muted">
            Promote the platform and earn a percent of referred membership
            subscriptions. You do not need a platform account to join. Platform
            users are already affiliates — sign in to open your dashboard.
          </p>
          <ul className="mt-6 max-w-xl list-disc space-y-2 pl-5 text-sm text-ink-muted">
            <li>Share a unique referral code and link.</li>
            <li>Commission is on platform subscriptions only, not trading PnL.</li>
            <li>Withdraw payable earnings as USDT after the hold.</li>
          </ul>
        </div>
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">
            Join as an affiliate
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Separate from platform membership. Upgrade to Free later if you
            want desks.
          </p>
          {error ? (
            <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <form action={signUpAffiliateAction} className="mt-4 space-y-3">
            <label className="block text-sm text-ink">
              Name
              <input
                name="name"
                required
                maxLength={80}
                autoComplete="name"
                className={BILLING_FIELD_CLASS}
              />
            </label>
            <label className="block text-sm text-ink">
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className={BILLING_FIELD_CLASS}
              />
            </label>
            <label className="block text-sm text-ink">
              Password
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className={BILLING_FIELD_CLASS}
              />
            </label>
            <label className="block text-sm text-ink">
              Referral code
              <input
                name="referralCode"
                defaultValue={referralCode}
                autoComplete="off"
                className={BILLING_FIELD_CLASS}
              />
              <span className="mt-1 block text-xs text-ink-muted">
                Optional. Use a code if someone referred you.
              </span>
            </label>
            <PendingSubmitButton
              pendingLabel="Creating…"
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              Create affiliate account
            </PendingSubmitButton>
          </form>
          <p className="mt-4 text-sm text-ink-muted">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-accent hover:text-accent-strong">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
