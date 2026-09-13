import Link from "next/link";
import { AffiliateArchiveButton } from "@/components/affiliate-archive-button";
import { AffiliateLinkActions } from "@/components/affiliate-link-actions";
import { AffiliatePayoutSettingsButton } from "@/components/affiliate-payout-settings";
import { AffiliateOrgChartFrame } from "@/components/affiliate-org-chart-frame";
import { CopyTextButton } from "@/components/copy-text-button";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  AFFILIATE_CAMPAIGN_NAME_MAX,
  AFFILIATE_LANDINGS,
  AFFILIATE_LINK_NAME_MAX,
  affiliateLandingLabel,
  affiliateLinkKindLabel,
  affiliatePortalPath,
  canArchiveAffiliateLink,
  affiliateRowShareUrl,
  monthJoinedLabel,
  withdrawDecision,
  type AffiliatePortalTab,
} from "@/lib/membership/affiliate";
import {
  createAffiliateCampaignAction,
  createAffiliateLinkAction,
  requestAffiliatePayoutAction,
  upgradeAffiliateToPlatformAction,
} from "@/lib/membership/affiliate-actions";
import type {
  AffiliateCampaignRow,
  AffiliateLinkRow,
  AffiliatePortal,
  PayoutRow,
} from "@/lib/membership/affiliate-store";
import { formatUsd } from "@/lib/membership/billing";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import type { BillingChain } from "@/lib/membership/wallet-store";
import { formatLocalDate, parseDisplayTime } from "@/lib/time/display";

export function AffiliateDashboard({
  portal,
  origin,
  arrears,
  payouts,
  chains,
  platformMember,
  tab,
  saved,
  error,
}: {
  portal: AffiliatePortal;
  origin: string;
  arrears: boolean;
  payouts: PayoutRow[];
  chains: BillingChain[];
  platformMember: boolean;
  tab: AffiliatePortalTab;
  saved: string | null;
  error: string | null;
}) {
  const withdraw = withdrawDecision({
    arrears,
    payableUsd: portal.payableUsd,
    minPayoutUsd: portal.settings.minPayoutUsd,
  });
  const payoutChains = chains.filter((chain) => chain.affiliatePayouts);
  const canWithdraw = withdraw.ok && payoutChains.length > 0;
  const chainName = (slug: string) =>
    chains.find((chain) => chain.slug === slug)?.name ?? slug;
  const sourceLabel = (userId: string) =>
    portal.downline.find((row) => row.userId === userId)?.label ?? "Member";
  const rateNote =
    portal.rates.source === "plan" && portal.rates.planName
      ? `Your ${portal.rates.planName} plan rates.`
      : platformMember && arrears
        ? "Unpaid subscription — program default rates until you pay again."
        : "Program default rates. Platform members earn their plan rates.";

  return (
    <div>
      <PageHeading title="Affiliates" />
      <p className="-mt-4 max-w-2xl text-sm text-ink-muted">
        Earn a percent of referred platform subscriptions. Pending commission
        sits on hold, then becomes payable Affiliate earnings. Not trading
        PnL.
      </p>
      <nav aria-label="Affiliate portal" className="mt-5 flex border-b border-line">
        <TabLink href={affiliatePortalPath("overview")} selected={tab === "overview"}>
          Overview
        </TabLink>
        <TabLink href={affiliatePortalPath("network")} selected={tab === "network"}>
          Network
        </TabLink>
        <TabLink href={affiliatePortalPath("campaigns")} selected={tab === "campaigns"}>
          Campaigns
        </TabLink>
        <TabLink href={affiliatePortalPath("links")} selected={tab === "links"}>
          Links
        </TabLink>
        <TabLink href={affiliatePortalPath("referrals")} selected={tab === "referrals"}>
          Referrals
        </TabLink>
        <TabLink href={affiliatePortalPath("payouts")} selected={tab === "payouts"}>
          Payouts
        </TabLink>
      </nav>
      {saved === "withdraw" ? (
        <p className="mt-6 text-sm text-success">
          Withdraw requested. Admin sends USDT and marks it paid.
        </p>
      ) : null}
      {saved === "payout-settings" ? (
        <p className="mt-6 text-sm text-success">Payout settings saved.</p>
      ) : null}
      {saved === "joined" ? (
        <p className="mt-6 text-sm text-success">
          You are in. Share your code to start attributing referrals.
        </p>
      ) : null}
      {saved === "campaign" ? (
        <p className="mt-6 text-sm text-success">Campaign created.</p>
      ) : null}
      {saved === "link" ? (
        <p className="mt-6 text-sm text-success">Link created.</p>
      ) : null}
      {saved === "campaign-archived" ? (
        <p className="mt-6 text-sm text-success">Campaign archived.</p>
      ) : null}
      {saved === "link-archived" ? (
        <p className="mt-6 text-sm text-success">Link archived.</p>
      ) : null}
      {saved === "link-renamed" ? (
        <p className="mt-6 text-sm text-success">Link renamed.</p>
      ) : null}
      {error ? (
        <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {!platformMember ? (
        <form
          action={upgradeAffiliateToPlatformAction}
          className="mt-6 rounded-card border border-line bg-surface p-5"
        >
          <h2 className="text-lg font-semibold tracking-tight">
            Platform membership
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            You are an affiliate only. Upgrade to open desks, billing, and the
            rest of the app on the Free plan.
          </p>
          <PendingSubmitButton
            pendingLabel="Upgrading…"
            className="mt-4 rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            Upgrade account to full platform membership (free to start)
          </PendingSubmitButton>
        </form>
      ) : null}
      {arrears ? (
        <p className="mt-6 text-sm text-warning">
          Your subscription is unpaid. New commissions use program default
          rates until you pay again. Withdraw stays locked while invoices are
          outstanding.
        </p>
      ) : null}
      {!portal.payoutSettings.address ? (
        <p className="mt-6 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Save a payout address in Manage payout settings on the Payouts tab.
          Withdraws and auto payout requests use that address so you do not
          enter it each time.
        </p>
      ) : null}

      {tab === "overview" ? (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Signups" value={String(portal.stats.attributed)} />
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
            <h2 className="text-lg font-semibold tracking-tight">
              Current rates
            </h2>
            <p className="mt-2 text-sm text-ink-muted">{rateNote}</p>
            <table className="mt-4 w-full max-w-md text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.12em] text-ink-muted">
                  <th className="py-1.5 font-medium">Level</th>
                  <th className="py-1.5 font-medium">Commission</th>
                </tr>
              </thead>
              <tbody>
                {portal.rates.rows.map((row) => (
                  <tr key={row.level} className="border-t border-line">
                    <td className="py-2 text-ink">L{row.level}</td>
                    <td className="py-2 tabular-nums text-ink">
                      {row.active ? `${row.ratePct}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 max-w-md border-t border-line pt-4">
              <p className="text-sm text-ink-muted">
                Paid plans pay higher L1–L5 on referred subscriptions.
              </p>
              {!platformMember ? (
                <form action={upgradeAffiliateToPlatformAction} className="mt-3">
                  <PendingSubmitButton
                    pendingLabel="Upgrading…"
                    className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
                  >
                    Upgrade to earn higher rates
                  </PendingSubmitButton>
                </form>
              ) : (
                <Link
                  href="/account/plans"
                  className="mt-3 inline-flex rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
                >
                  Upgrade to earn higher rates
                </Link>
              )}
            </div>
          </section>
        </>
      ) : null}

      {tab === "network" ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold tracking-tight">Downline</h2>
            {portal.downline.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No referrals yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                    <tr>
                      <th className="pb-2 pr-4 font-medium">Affiliate</th>
                      <th className="pb-2 pr-4 font-medium">Level</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {portal.downline.map((row) => (
                      <tr key={row.userId} id={`downline-${row.userId}`}>
                        <td className="py-2 pr-4 text-ink">{row.label}</td>
                        <td className="py-2 pr-4 tabular-nums text-ink">
                          L{row.level}
                        </td>
                        <td className="py-2 pr-4 text-ink-muted">
                          {row.firstPaidAt ? "paid" : "signup"}
                        </td>
                        <td className="py-2 text-ink-muted">
                          {monthJoinedLabel(row.attributedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <AffiliateOrgChartFrame nodes={portal.tree} />
        </div>
      ) : null}

      {tab === "referrals" ? (
        <section className="mt-6 rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">Commissions</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Each row is a held or payable percent of a referred subscription.
          </p>
          {portal.commissions.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No commissions yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">From</th>
                    <th className="pb-2 pr-4 font-medium">Level</th>
                    <th className="pb-2 pr-4 font-medium">Rate</th>
                    <th className="pb-2 pr-4 font-medium">Amount</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Hold until</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {portal.commissions.map((row) => {
                    const created = parseDisplayTime(row.createdAt);
                    const hold = parseDisplayTime(row.holdUntil);
                    return (
                      <tr key={row.id}>
                        <td className="py-2 pr-4 text-ink-muted">
                          {created ? formatLocalDate(created) : "—"}
                        </td>
                        <td className="py-2 pr-4 text-ink">
                          {sourceLabel(row.sourceUserId)}
                        </td>
                        <td className="py-2 pr-4 tabular-nums text-ink">
                          L{row.level}
                        </td>
                        <td className="py-2 pr-4 tabular-nums text-ink">
                          {row.ratePct}%
                        </td>
                        <td className="py-2 pr-4 tabular-nums text-ink">
                          {formatUsd(row.amountUsd)}
                        </td>
                        <td className="py-2 pr-4 capitalize text-ink-muted">
                          {row.status}
                        </td>
                        <td className="py-2 text-ink-muted">
                          {hold ? formatLocalDate(hold) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "campaigns" ? (
        <div className="mt-6 space-y-5">
          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold tracking-tight">
              Create a campaign
            </h2>
            <form
              action={createAffiliateCampaignAction}
              className="mt-4 flex flex-wrap items-end gap-3"
            >
              <label className="min-w-[12rem] flex-1 text-sm text-ink">
                Name
                <input
                  name="name"
                  required
                  maxLength={AFFILIATE_CAMPAIGN_NAME_MAX}
                  className={BILLING_FIELD_CLASS}
                />
              </label>
              <PendingSubmitButton
                pendingLabel="Creating…"
                className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
              >
                Create campaign
              </PendingSubmitButton>
            </form>
          </section>
          <section>
            <h2 className="text-lg font-semibold tracking-tight">
              Your campaigns
            </h2>
            {portal.campaigns.length === 0 &&
            portal.archivedCampaigns.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">No campaigns yet.</p>
            ) : (
              <AffiliateCampaignsTable portal={portal} />
            )}
          </section>
        </div>
      ) : null}

      {tab === "links" ? (
        <div className="mt-6 space-y-5">
          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold tracking-tight">
              Create a link
            </h2>
            <form
              action={createAffiliateLinkAction}
              className="mt-4 flex flex-wrap items-end gap-3"
            >
              <label className="min-w-[12rem] flex-1 text-sm text-ink">
                Name
                <input
                  name="name"
                  required
                  maxLength={AFFILIATE_LINK_NAME_MAX}
                  className={BILLING_FIELD_CLASS}
                />
              </label>
              <label className="w-44 shrink-0 text-sm text-ink">
                Landing page
                <select
                  name="landing"
                  defaultValue="home"
                  className={BILLING_FIELD_CLASS}
                >
                  {AFFILIATE_LANDINGS.map((landing) => (
                    <option key={landing} value={landing}>
                      {affiliateLandingLabel(landing)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-[12rem] flex-1 text-sm text-ink">
                Campaign
                <select name="campaignId" defaultValue="" className={BILLING_FIELD_CLASS}>
                  <option value="">No campaign</option>
                  {portal.campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </label>
              <PendingSubmitButton
                pendingLabel="Creating…"
                className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
              >
                Create link
              </PendingSubmitButton>
            </form>
          </section>
          <section>
            <h2 className="text-lg font-semibold tracking-tight">Your links</h2>
            {portal.links.length === 0 && portal.archivedLinks.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">
                A referral code could not be created yet. Refresh and try again.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
                    <tr>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        Name
                      </th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        Landing
                      </th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        Campaign
                      </th>
                      <th className="px-4 py-3 font-medium">Link</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        Type
                      </th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        Status
                      </th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...portal.links, ...portal.archivedLinks].map((link) => (
                      <AffiliateLinkRowView
                        key={link.id}
                        link={link}
                        origin={origin}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === "payouts" ? (
        <div className="mt-6 space-y-5">
          <section className="rounded-card border border-line bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">
                Withdraw USDT
              </h2>
              <AffiliatePayoutSettingsButton
                settings={portal.payoutSettings}
                minPayoutUsd={portal.settings.minPayoutUsd}
                chains={payoutChains.map((chain) => ({
                  slug: chain.slug,
                  name: chain.name,
                }))}
              />
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              Payable {formatUsd(portal.payableUsd)}. Minimum{" "}
              {formatUsd(portal.settings.minPayoutUsd)}. Last payout{" "}
              {portal.lastPayoutAt ? monthJoinedLabel(portal.lastPayoutAt) : "—"}.
            </p>
            {!withdraw.ok ? (
              <p className="mt-3 text-sm text-warning">{withdraw.reason}</p>
            ) : null}
            {withdraw.ok && payoutChains.length === 0 ? (
              <p className="mt-3 text-sm text-warning">
                Affiliate payouts are not enabled on any chain yet. An admin can
                tick this on Settings → Crypto.
              </p>
            ) : null}
            <form
              action={requestAffiliatePayoutAction}
              className="mt-4 flex flex-wrap items-end gap-3"
            >
              <label className="w-44 shrink-0 text-sm text-ink">
                Chain
                <select
                  name="network"
                  disabled={!canWithdraw}
                  className={BILLING_FIELD_CLASS}
                  defaultValue={
                    portal.payoutSettings.network ?? payoutChains[0]?.slug ?? ""
                  }
                >
                  {payoutChains.map((chain) => (
                    <option key={chain.id} value={chain.slug}>
                      {chain.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="w-32 shrink-0 text-sm text-ink">
                Amount
                <input
                  name="amountUsd"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={portal.settings.minPayoutUsd}
                  max={portal.payableUsd}
                  disabled={!canWithdraw}
                  placeholder="0.00"
                  className={BILLING_FIELD_CLASS}
                />
              </label>
              <label className="min-w-[12rem] flex-1 text-sm text-ink">
                Address
                <input
                  name="address"
                  disabled={!canWithdraw}
                  defaultValue={portal.payoutSettings.address ?? ""}
                  placeholder="0x…"
                  className={BILLING_FIELD_CLASS}
                />
              </label>
              <PendingSubmitButton
                pendingLabel="Requesting…"
                disabled={!canWithdraw}
                className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink disabled:bg-accent-strong/40"
              >
                Request withdraw
              </PendingSubmitButton>
            </form>
          </section>
          <section>
            <h2 className="text-lg font-semibold tracking-tight">Payouts</h2>
            {payouts.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">No payouts yet.</p>
            ) : (
              <AffiliatePayoutsTable
                payouts={payouts}
                chainName={chainName}
              />
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function AffiliatePayoutsTable({
  payouts,
  chainName,
}: {
  payouts: PayoutRow[];
  chainName: (slug: string) => string;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
          <tr>
            <th className="px-4 py-3 font-medium whitespace-nowrap">Date</th>
            <th className="px-4 py-3 font-medium whitespace-nowrap">Amount</th>
            <th className="px-4 py-3 font-medium whitespace-nowrap">Status</th>
            <th className="px-4 py-3 font-medium whitespace-nowrap">Chain</th>
            <th className="px-4 py-3 font-medium">Address</th>
            <th className="px-4 py-3 font-medium whitespace-nowrap">Paid</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((payout) => {
            const created = parseDisplayTime(payout.createdAt);
            const paid = parseDisplayTime(payout.paidAt);
            return (
              <tr
                key={payout.id}
                className="border-b border-line last:border-b-0"
              >
                <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                  {created ? formatLocalDate(created) : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums whitespace-nowrap text-ink">
                  {formatUsd(payout.amountUsd)}
                </td>
                <td className="px-4 py-3 capitalize whitespace-nowrap text-ink-muted">
                  {payout.status}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink">
                  {payout.network ? chainName(payout.network) : "—"}
                </td>
                <td className="max-w-64 truncate px-4 py-3 font-mono text-xs text-ink-muted">
                  {payout.address ?? "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                  {paid ? formatLocalDate(paid) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AffiliateCampaignsTable({ portal }: { portal: AffiliatePortal }) {
  const links = [...portal.links, ...portal.archivedLinks];
  return (
    <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
          <tr>
            <th className="px-4 py-3 font-medium whitespace-nowrap">Name</th>
            <th className="px-4 py-3 font-medium whitespace-nowrap">Links</th>
            <th className="px-4 py-3 font-medium whitespace-nowrap">
              Signups
            </th>
            <th className="px-4 py-3 font-medium whitespace-nowrap">Status</th>
            <th className="px-4 py-3 font-medium whitespace-nowrap">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {[...portal.campaigns, ...portal.archivedCampaigns].map((campaign) => (
            <AffiliateCampaignRowView
              key={campaign.id}
              campaign={campaign}
              linkCount={
                links.filter((link) => link.campaignId === campaign.id).length
              }
              signups={
                portal.downline.filter(
                  (row) => row.level === 1 && row.campaignId === campaign.id,
                ).length
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AffiliateCampaignRowView({
  campaign,
  linkCount,
  signups,
}: {
  campaign: AffiliateCampaignRow;
  linkCount: number;
  signups: number;
}) {
  const archived = Boolean(campaign.archivedAt);
  const muted = archived ? "text-ink-muted" : "text-ink";
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className={`px-4 py-3 whitespace-nowrap ${muted}`}>{campaign.name}</td>
      <td className={`px-4 py-3 tabular-nums whitespace-nowrap ${muted}`}>
        {linkCount}
      </td>
      <td className={`px-4 py-3 tabular-nums whitespace-nowrap ${muted}`}>
        {signups}
      </td>
      <td className={`px-4 py-3 whitespace-nowrap ${muted}`}>
        {archived ? "Archived" : "Active"}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {archived ? (
          <span className="text-ink-faint">—</span>
        ) : (
          <AffiliateArchiveButton
            kind="campaign"
            id={campaign.id}
            name={campaign.name}
          />
        )}
      </td>
    </tr>
  );
}

function AffiliateLinkRowView({
  link,
  origin,
}: {
  link: AffiliateLinkRow;
  origin: string;
}) {
  const archived = Boolean(link.archivedAt);
  const url = origin
    ? affiliateRowShareUrl(origin, link)
    : link.kind === "system"
      ? `/affiliates?ref=${encodeURIComponent(link.slug)}`
      : `/r/${link.slug}`;
  const muted = archived ? "text-ink-muted" : "text-ink";
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className={`px-4 py-3 whitespace-nowrap ${muted}`}>{link.name}</td>
      <td className={`px-4 py-3 whitespace-nowrap ${muted}`}>
        {affiliateLandingLabel(link.landing)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
        {link.campaignName ?? "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-nowrap items-center gap-2">
          <input
            readOnly
            size={1}
            value={url}
            aria-label={`${link.name} share link`}
            className="w-56 min-w-0 truncate rounded-control border border-line bg-canvas px-2.5 py-1.5 font-mono text-xs text-ink-muted"
          />
          <span className="shrink-0">
            <CopyTextButton text={url} label="Copy" />
          </span>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
        {affiliateLinkKindLabel(link.kind)}
      </td>
      <td className={`px-4 py-3 whitespace-nowrap ${muted}`}>
        {archived ? "Archived" : "Active"}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {link.kind === "custom" ? (
          <AffiliateLinkActions
            id={link.id}
            name={link.name}
            canArchive={!archived && canArchiveAffiliateLink(link.kind)}
          />
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </td>
    </tr>
  );
}

function TabLink({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        selected
          ? "border-accent text-ink"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
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
