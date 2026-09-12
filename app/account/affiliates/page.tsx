import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { AffiliateOrgChart } from "@/components/affiliate-org-chart";
import { CopyTextButton } from "@/components/copy-text-button";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getSessionMember } from "@/lib/auth/session";
import {
  monthJoinedLabel,
  referralShareUrl,
  withdrawDecision,
} from "@/lib/membership/affiliate";
import { requestAffiliatePayoutAction } from "@/lib/membership/affiliate-actions";
import {
  listMemberPayouts,
  loadAffiliatePortal,
  loadMemberEnroll,
} from "@/lib/membership/affiliate-store";
import { formatUsd } from "@/lib/membership/billing";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Affiliates",
  description: "Referral kit, downline, and affiliate payouts.",
};

export default async function AccountAffiliatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const params = await searchParams;
  const error = firstSearchValue(params.error);
  const saved = firstSearchValue(params.saved);
  const enroll = await loadMemberEnroll(member.id);
  const portal = await loadAffiliatePortal(
    member.id,
    enroll.currentEnroll,
    enroll.lastEnrollPlanId,
  );
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "";
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : "";
  const shareUrl =
    portal.code && origin ? referralShareUrl(origin, portal.code) : "";
  const actionsOn = portal.enroll === "enrolled";
  const withdraw = withdrawDecision({
    enrollState: portal.enroll,
    arrears: enroll.arrears,
    payableUsd: portal.payableUsd,
    minPayoutUsd: portal.settings.minPayoutUsd,
  });
  const payouts = await listMemberPayouts(member.id);

  return (
    <div>
      <PageHeading title="Affiliates" />
      <p className="-mt-4 max-w-2xl text-sm text-ink-muted">
        Earn a percent of referred platform subscriptions. Pending commission
        sits on hold, then becomes payable Affiliate earnings. Not trading
        PnL.
      </p>
      {saved === "withdraw" ? (
        <p className="mt-6 text-sm text-success">
          Withdraw requested. Admin sends USDT and marks it paid.
        </p>
      ) : null}
      {error ? (
        <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {portal.enroll === "never" ? (
        <section className="mt-6 rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">
            Affiliate enroll
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            This plan cannot enroll. Upgrade to get a referral code, see your
            downline, and withdraw USDT.
          </p>
          <Link
            href="/account/plans"
            className="mt-4 inline-flex rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            Upgrade
          </Link>
        </section>
      ) : null}

      {portal.enroll === "lost" ? (
        <p className="mt-6 text-sm text-warning">
          Enroll is off on your current plan. You still see this tree and keep
          earning at your last enroll-plan rates. Codes and withdraw stay
          locked until enroll is on again.
        </p>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Attributed" value={String(portal.stats.attributed)} />
        <StatTile
          label="Paid conversions"
          value={String(portal.stats.paid)}
        />
        <StatTile
          label="Conversion"
          value={`${portal.stats.conversionPct}%`}
        />
        <StatTile
          label="Referred MRR"
          value={formatUsd(portal.stats.referredMrrUsd)}
        />
        <StatTile
          label="Pending"
          value={formatUsd(portal.pendingUsd)}
        />
        <StatTile
          label="Payable"
          value={formatUsd(portal.payableUsd)}
        />
        <StatTile
          label="Paid out"
          value={formatUsd(portal.paidOutUsd)}
        />
        <StatTile
          label="Earned (30d)"
          value={formatUsd(portal.stats.earnedPeriodUsd)}
        />
      </section>

      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Referral kit</h2>
        {portal.code ? (
          <>
            <p className="mt-2 font-mono text-lg text-ink">{portal.code}</p>
            {shareUrl ? (
              <p className="mt-1 break-all text-sm text-ink-muted">{shareUrl}</p>
            ) : null}
            {actionsOn ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyTextButton text={portal.code} label="Copy code" />
                {shareUrl ? (
                  <CopyTextButton text={shareUrl} label="Copy link" />
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-xs text-ink-faint">
                Copy and invite stay locked until enroll is on.
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            A referral code appears after you enroll.
          </p>
        )}
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">Downline</h2>
          {portal.downline.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">No referrals yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {portal.downline.map((row) => (
                <li key={row.userId} id={`downline-${row.userId}`}>
                  L{row.level} · {row.label} ·{" "}
                  {row.firstPaidAt ? "paid" : "attributed"} ·{" "}
                  {monthJoinedLabel(row.attributedAt)}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">Org chart</h2>
          {portal.tree.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">
              The chart fills as people join with your code.
            </p>
          ) : (
            <div className="mt-3">
              <AffiliateOrgChart nodes={portal.tree} />
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">
          Withdraw USDT
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Payable {formatUsd(portal.payableUsd)}. Minimum{" "}
          {formatUsd(portal.settings.minPayoutUsd)}. Last payout{" "}
          {portal.lastPayoutAt ? monthJoinedLabel(portal.lastPayoutAt) : "—"}.
        </p>
        {!withdraw.ok ? (
          <p className="mt-3 text-sm text-warning">{withdraw.reason}</p>
        ) : null}
        <form action={requestAffiliatePayoutAction} className="mt-4 max-w-lg space-y-3">
          <label className="block text-sm text-ink">
            Network
            <select
              name="network"
              disabled={!withdraw.ok}
              className={BILLING_FIELD_CLASS}
              defaultValue={portal.settings.usdtNetworks[0] ?? ""}
            >
              {portal.settings.usdtNetworks.map((network) => (
                <option key={network} value={network}>
                  {network}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-ink">
            Address
            <input
              name="address"
              disabled={!withdraw.ok}
              placeholder="0x…"
              className={BILLING_FIELD_CLASS}
            />
          </label>
          <PendingSubmitButton
            pendingLabel="Requesting…"
            disabled={!withdraw.ok}
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink disabled:bg-accent-strong/40"
          >
            Request withdraw
          </PendingSubmitButton>
        </form>
        {payouts.length > 0 ? (
          <ul className="mt-5 space-y-2 text-sm text-ink-muted">
            {payouts.map((payout) => (
              <li key={payout.id}>
                {formatUsd(payout.amountUsd)} · {payout.status}
                {payout.network ? ` · ${payout.network}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}
