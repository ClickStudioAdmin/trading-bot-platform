import type { ReactNode } from "react";
import Link from "next/link";
import { AffiliateArchiveButton } from "@/components/affiliate-archive-button";
import { ColumnHint } from "@/components/column-hint";
import { AffiliateLinkActions } from "@/components/affiliate-link-actions";
import { AffiliatePayoutSettingsForm } from "@/components/affiliate-payout-settings";
import { AffiliateOrgChartFrame } from "@/components/affiliate-org-chart-frame";
import { CopyTextButton } from "@/components/copy-text-button";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  AFFILIATE_ALIAS_MAX,
  AFFILIATE_CAMPAIGN_NAME_MAX,
  AFFILIATE_LANDINGS,
  AFFILIATE_LINK_NAME_MAX,
  payoutStatusLabel,
  referralShareUrl,
  affiliateLandingLabel,
  affiliateLinkKindLabel,
  affiliatePageLabel,
  affiliateNetworkPath,
  affiliatePortalPagePath,
  affiliatePortalPath,
  canArchiveAffiliateLink,
  paginateAffiliateList,
  affiliateDownlinePersonMeta,
  affiliateRowShareUrl,
  monthJoinedLabel,
  withdrawDecision,
  type AffiliateNetworkView,
  type AffiliatePortalTab,
} from "@/lib/membership/affiliate";
import {
  createAffiliateCampaignAction,
  createAffiliateLinkAction,
  requestAffiliatePayoutAction,
  saveAffiliateAliasAction,
  upgradeAffiliateToPlatformAction,
} from "@/lib/membership/affiliate-actions";
import type {
  AffiliateCampaignRow,
  AffiliateLinkRow,
  AffiliatePortal,
  PayoutRow,
} from "@/lib/membership/affiliate-store";
import { formatCount, formatUsd } from "@/lib/membership/billing";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import type { BillingChain } from "@/lib/membership/wallet-store";
import { formatLocalDate, parseDisplayTime } from "@/lib/time/display";

export function AffiliateDashboard({
  portal,
  origin,
  arrears,
  payouts,
  chains,
  profileAlias,
  platformMember,
  tab,
  view,
  page,
  saved,
  error,
}: {
  portal: AffiliatePortal;
  origin: string;
  arrears: boolean;
  payouts: PayoutRow[];
  chains: BillingChain[];
  profileAlias: string;
  platformMember: boolean;
  tab: AffiliatePortalTab;
  view: AffiliateNetworkView;
  page: number;
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
  const downlinePage = paginateAffiliateList(portal.downline, page);
  const commissionPage = paginateAffiliateList(portal.commissions, page);
  const campaignPage = paginateAffiliateList(
    [...portal.campaigns, ...portal.archivedCampaigns],
    page,
  );
  const linkPage = paginateAffiliateList(
    [...portal.links, ...portal.archivedLinks],
    page,
  );
  const payoutPage = paginateAffiliateList(payouts, page);
  const rateNote =
    portal.rates.source === "plan" && portal.rates.planName
      ? `You are on ${portal.rates.planName} rates. Affiliate-only and unpaid subscriptions use program default rates. Paid plans use that plan’s L1–L5.`
      : platformMember && arrears
        ? "Unpaid / affiliate-only uses program rates. Paid plans use that plan’s L1–L5. Your unpaid subscription is on program defaults until you pay again."
        : "Unpaid / affiliate-only uses program rates. Paid plans use that plan’s L1–L5.";
  const defaultShareUrl = portal.code
    ? referralShareUrl(origin, portal.code)
    : "";
  const shareRates = portal.rates.rows
    .filter((row) => row.active)
    .map((row) => `L${row.level} ${row.ratePct}%`)
    .join(" · ");

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
        <TabLink href={affiliatePortalPath("settings")} selected={tab === "settings"}>
          Settings
        </TabLink>
      </nav>
      {saved === "withdraw" ? (
        <p className="mt-6 text-sm text-success">
          Withdraw requested. It will go out on the next payout list.
        </p>
      ) : null}
      {saved === "payout-settings" ? (
        <p className="mt-6 text-sm text-success">Payout settings saved.</p>
      ) : null}
      {saved === "alias" ? (
        <p className="mt-6 text-sm text-success">
          Affiliate alias saved. Your network shows this name.
        </p>
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
          Save a payout address on the Settings tab. Withdraws and auto payout
          requests use that address so you do not enter it each time.
        </p>
      ) : null}

      {tab === "overview" ? (
        <>
          <p className="mt-6 max-w-2xl text-sm text-ink-muted">
            Signups stay yours even if they later click someone else’s link.
            Commission starts when they first pay.
          </p>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Signups"
              value={formatCount(portal.stats.attributed)}
              hint="People who joined through your referral, paid or not."
            />
            <StatTile
              label="Paid conversions"
              value={formatCount(portal.stats.paid)}
              hint="Signups who have paid for a membership at least once."
            />
            <StatTile
              label="Conversion"
              value={`${portal.stats.conversionPct}%`}
              hint="Paid conversions as a percent of signups."
            />
            <StatTile
              label="Referred MRR"
              value={formatUsd(portal.stats.referredMrrUsd)}
              hint="What your paid downline pays the platform each month. Not your commission."
            />
            <StatTile
              label="Pending"
              value={formatUsd(portal.pendingUsd)}
              hint="Your commission still on hold. It becomes payable after the hold, unless refunded."
            />
            <StatTile
              label="Payable"
              value={formatUsd(portal.payableUsd)}
              hint="Commission past the hold that you can withdraw."
            />
            <StatTile
              label="Paid out"
              value={formatUsd(portal.paidOutUsd)}
              hint="Commission already sent to your payout address."
            />
            <StatTile
              label="Earned (30d)"
              value={formatUsd(portal.stats.earnedPeriodUsd)}
              hint="Commission credited to you in the last 30 days, including amounts still on hold."
            />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2 lg:items-start">
            <div className="rounded-card border border-line bg-surface p-5">
              <h2 className="text-lg font-semibold tracking-tight">
                Current rates
              </h2>
              <p className="mt-2 text-sm text-ink-muted">{rateNote}</p>
              <table className="mt-4 w-full text-sm">
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
              <div className="mt-4 border-t border-line pt-4">
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
            </div>
            <div className="rounded-card border border-line bg-surface p-5">
              <h2 className="text-lg font-semibold tracking-tight">
                Default link
              </h2>
              <p className="mt-2 text-sm text-ink-muted">
                System Default. Share this. Custom landings are on the Links
                tab.
              </p>
              {defaultShareUrl ? (
                <>
                  <p className="mt-4 break-all font-mono text-sm text-ink">
                    {defaultShareUrl}
                  </p>
                  <div className="mt-3">
                    <CopyTextButton text={defaultShareUrl} label="Copy link" />
                  </div>
                  {shareRates ? (
                    <p className="mt-4 text-sm text-ink-muted">
                      Your current rates: {shareRates}.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-4 text-sm text-ink-muted">
                  Your referral code will show here after the first visit.
                </p>
              )}
            </div>
          </section>
        </>
      ) : null}

      {tab === "network" ? (
        <div className="mt-6">
          <div className="flex justify-end">
            <div
              role="tablist"
              aria-label="Network view"
              className="flex w-fit rounded-control border border-line bg-surface p-0.5"
            >
              <NetworkViewLink
                href={affiliateNetworkPath("list", page)}
                selected={view === "list"}
              >
                List
              </NetworkViewLink>
              <NetworkViewLink
                href={affiliateNetworkPath("chart")}
                selected={view === "chart"}
              >
                Chart
              </NetworkViewLink>
            </div>
          </div>
          {view === "chart" ? (
            <div className="mt-4">
              <AffiliateOrgChartFrame
                nodes={portal.tree}
                rootPlanName={portal.rates.planName}
              />
            </div>
          ) : (
            <section className="mt-4 rounded-card border border-line bg-surface p-5">
              <h3 className="text-sm font-medium text-ink">Downline</h3>
              {portal.downline.length === 0 ? (
                <p className="mt-2 text-sm text-ink-muted">No referrals yet.</p>
              ) : (
                <>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                        <tr>
                          <th className="pb-2 pr-4 font-medium">Affiliate</th>
                          <th className="pb-2 pr-4 font-medium">Plan</th>
                          <th className="pb-2 pr-4 font-medium">Level</th>
                          <th className="pb-2 pr-4 font-medium">Status</th>
                          <th className="pb-2 pr-4 font-medium">To you</th>
                          <th className="pb-2 font-medium">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {downlinePage.rows.map((row) => {
                          const person = affiliateDownlinePersonMeta(
                            row,
                            portal.rates,
                          );
                          return (
                            <tr key={row.userId} id={`downline-${row.userId}`}>
                              <td className="py-2 pr-4 text-ink">{row.label}</td>
                              <td className="py-2 pr-4 text-ink">
                                {person.planLabel}
                              </td>
                              <td className="py-2 pr-4 tabular-nums text-ink">
                                L{row.level}
                              </td>
                              <td className="py-2 pr-4 text-ink-muted">
                                {row.firstPaidAt ? "paid" : "signup"}
                              </td>
                              <td className="py-2 pr-4 tabular-nums text-ink">
                                {person.runRateLabel}
                              </td>
                              <td className="py-2 text-ink-muted">
                                {monthJoinedLabel(row.attributedAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <AffiliateTablePager tab="network" list={downlinePage} />
                </>
              )}
            </section>
          )}
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
            <>
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
                    {commissionPage.rows.map((row) => {
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
              <AffiliateTablePager tab="referrals" list={commissionPage} />
            </>
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
              <AffiliateCampaignsTable
                portal={portal}
                campaigns={campaignPage.rows}
                pager={<AffiliateTablePager tab="campaigns" list={campaignPage} />}
              />
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
                    {linkPage.rows.map((link) => (
                      <AffiliateLinkRowView
                        key={link.id}
                        link={link}
                        origin={origin}
                      />
                    ))}
                  </tbody>
                </table>
                <div className="px-4 pb-4">
                  <AffiliateTablePager tab="links" list={linkPage} />
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === "payouts" ? (
        <div className="mt-6 space-y-5">
          <section className="rounded-card border border-line bg-surface p-5">
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
                payouts={payoutPage.rows}
                chainName={chainName}
                pager={<AffiliateTablePager tab="payouts" list={payoutPage} />}
              />
            )}
          </section>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="mt-6 space-y-5">
          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold tracking-tight">
              Affiliate alias
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Shown on your affiliate network instead of your real name. This is
              not your trader alias — that stays on Account Settings for copy
              trading.
            </p>
            <form action={saveAffiliateAliasAction} className="mt-4 space-y-3">
              <label className="block text-sm text-ink">
                Alias
                <input
                  name="alias"
                  defaultValue={profileAlias}
                  required
                  minLength={2}
                  maxLength={AFFILIATE_ALIAS_MAX}
                  autoComplete="nickname"
                  className={BILLING_FIELD_CLASS}
                />
                <span className="mt-1 block text-xs text-ink-muted">
                  2–32 characters. Letters, numbers, spaces, _ and -. Start
                  with a letter.
                </span>
              </label>
              <PendingSubmitButton
                pendingLabel="Saving…"
                className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
              >
                Save alias
              </PendingSubmitButton>
            </form>
          </section>
          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold tracking-tight">
              Payout settings
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Saved chain and address are used on each withdraw so you do not
              re-enter them. Auto payouts open a payout request for the full
              payable when the balance is over the amount you set. Requests go
              onto the next payout list. Admin sends USDT, then marks that file
              paid.
            </p>
            {payoutChains.length === 0 ? (
              <p className="mt-3 text-sm text-warning">
                Affiliate payouts are not enabled on any chain yet. An admin can
                tick this on Settings → Crypto.
              </p>
            ) : (
              <AffiliatePayoutSettingsForm
                settings={portal.payoutSettings}
                minPayoutUsd={portal.settings.minPayoutUsd}
                chains={payoutChains.map((chain) => ({
                  slug: chain.slug,
                  name: chain.name,
                }))}
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
  pager,
}: {
  payouts: PayoutRow[];
  chainName: (slug: string) => string;
  pager: ReactNode;
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
                <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                  {payoutStatusLabel(payout.status)}
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
      <div className="px-4 pb-4">{pager}</div>
    </div>
  );
}

function AffiliateCampaignsTable({
  portal,
  campaigns,
  pager,
}: {
  portal: AffiliatePortal;
  campaigns: AffiliateCampaignRow[];
  pager: ReactNode;
}) {
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
          {campaigns.map((campaign) => (
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
      <div className="px-4 pb-4">{pager}</div>
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

function AffiliateTablePager({
  tab,
  list,
}: {
  tab: AffiliatePortalTab;
  list: {
    page: number;
    pageCount: number;
    total: number;
    from: number;
    to: number;
  };
}) {
  if (list.total === 0) {
    return null;
  }
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
      <p>{affiliatePageLabel(list)}</p>
      {list.pageCount > 1 ? (
        <div className="flex gap-2">
          {list.page > 1 ? (
            <Link
              href={affiliatePortalPagePath(tab, list.page - 1)}
              className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Previous
            </Link>
          ) : null}
          {list.page < list.pageCount ? (
            <Link
              href={affiliatePortalPagePath(tab, list.page + 1)}
              className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function NetworkViewLink({
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
      role="tab"
      aria-selected={selected}
      className={
        selected
          ? "rounded-control bg-surface-raised px-3 py-1.5 text-sm font-medium text-ink"
          : "rounded-control px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
      }
    >
      {children}
    </Link>
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

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        <ColumnHint label={label} hint={hint} />
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}
