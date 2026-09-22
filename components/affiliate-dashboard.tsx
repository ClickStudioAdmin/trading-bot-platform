import Link from "next/link";
import { AffiliateArchiveButton } from "@/components/affiliate-archive-button";
import { ColumnHint } from "@/components/column-hint";
import { AffiliateLinkActions } from "@/components/affiliate-link-actions";
import { AffiliatePayoutSettingsForm } from "@/components/affiliate-payout-settings";
import { AffiliateOrgChartFrame } from "@/components/affiliate-org-chart-frame";
import { CopyTextButton } from "@/components/copy-text-button";
import { IconFilterClear } from "@/components/icons";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  LiveGetForm,
  SortTh,
  StatusBadge,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TableCard,
  TableFilterField,
  TableFilterSession,
  TableLabelButton,
  TABLE_FILTER_FIELD_CLASS,
  TablePager,
} from "@/components/table-chrome";
import {
  AFFILIATE_ALIAS_MAX,
  AFFILIATE_CAMPAIGN_NAME_MAX,
  AFFILIATE_LANDINGS,
  AFFILIATE_LINK_NAME_MAX,
  affiliateLandingLabel,
  affiliateLinkKindLabel,
  affiliateListDefaults,
  affiliateListFilterParams,
  affiliateListQueryParams,
  affiliateNetworkPath,
  affiliatePortalPagePath,
  affiliatePortalPath,
  affiliateDownlinePersonMeta,
  affiliateRowShareUrl,
  canArchiveAffiliateLink,
  matchesAffiliateArchiveStatus,
  matchesAffiliateNeedle,
  monthJoinedLabel,
  paginateAffiliateList,
  payoutStatusLabel,
  referralShareUrl,
  shortenPayoutAddress,
  withdrawDecision,
  type AffiliateListQuery,
  type AffiliateNetworkView,
  type AffiliatePortalTab,
} from "@/lib/membership/affiliate";
import {
  compareTableNum,
  compareTableText,
  tableSortHref,
} from "@/lib/table-chrome";
import {
  createAffiliateCampaignAction,
  createAffiliateLinkAction,
  requestAffiliatePayoutAction,
  saveAffiliateAliasAction,
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
import { AppSelect } from "@/components/app-select";

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
  tableQuery,
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
  tableQuery: AffiliateListQuery;
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
  const queryExtra = affiliateListQueryParams(tableQuery, tab);
  const allCampaigns = [...portal.campaigns, ...portal.archivedCampaigns];
  const allLinks = [...portal.links, ...portal.archivedLinks];
  const downlineRows = [...portal.downline]
    .filter((row) => {
      const person = affiliateDownlinePersonMeta(row, portal.rates);
      const paid = Boolean(row.firstPaidAt);
      if (tableQuery.status === "paid" && !paid) {
        return false;
      }
      if (tableQuery.status === "signup" && paid) {
        return false;
      }
      return matchesAffiliateNeedle(
        tableQuery.q,
        row.label,
        person.planLabel,
        paid ? "paid" : "signup",
      );
    })
    .sort((left, right) => {
      const leftMeta = affiliateDownlinePersonMeta(left, portal.rates);
      const rightMeta = affiliateDownlinePersonMeta(right, portal.rates);
      if (tableQuery.sort === "affiliate") {
        return compareTableText(left.label, right.label, tableQuery.dir);
      }
      if (tableQuery.sort === "plan") {
        return compareTableText(leftMeta.planLabel, rightMeta.planLabel, tableQuery.dir);
      }
      if (tableQuery.sort === "level") {
        return compareTableNum(left.level, right.level, tableQuery.dir);
      }
      if (tableQuery.sort === "status") {
        return compareTableText(
          left.firstPaidAt ? "paid" : "signup",
          right.firstPaidAt ? "paid" : "signup",
          tableQuery.dir,
        );
      }
      if (tableQuery.sort === "toYou") {
        return compareTableNum(leftMeta.runRateUsd, rightMeta.runRateUsd, tableQuery.dir);
      }
      return compareTableText(left.attributedAt, right.attributedAt, tableQuery.dir);
    });
  const commissionRows = [...portal.commissions]
    .filter((row) => {
      if (tableQuery.status && row.status !== tableQuery.status) {
        return false;
      }
      return matchesAffiliateNeedle(
        tableQuery.q,
        sourceLabel(row.sourceUserId),
        row.status,
      );
    })
    .sort((left, right) => {
      if (tableQuery.sort === "from") {
        return compareTableText(
          sourceLabel(left.sourceUserId),
          sourceLabel(right.sourceUserId),
          tableQuery.dir,
        );
      }
      if (tableQuery.sort === "level") {
        return compareTableNum(left.level, right.level, tableQuery.dir);
      }
      if (tableQuery.sort === "rate") {
        return compareTableNum(left.ratePct, right.ratePct, tableQuery.dir);
      }
      if (tableQuery.sort === "amount") {
        return compareTableNum(left.amountUsd, right.amountUsd, tableQuery.dir);
      }
      if (tableQuery.sort === "status") {
        return compareTableText(left.status, right.status, tableQuery.dir);
      }
      if (tableQuery.sort === "hold") {
        return compareTableText(left.holdUntil, right.holdUntil, tableQuery.dir);
      }
      return compareTableText(left.createdAt, right.createdAt, tableQuery.dir);
    });
  const campaignRows = allCampaigns
    .filter((campaign) => {
      if (!matchesAffiliateArchiveStatus(campaign.archivedAt, tableQuery.status)) {
        return false;
      }
      return matchesAffiliateNeedle(tableQuery.q, campaign.name);
    })
    .sort((left, right) => {
      const leftUrls = allLinks.filter((link) => link.campaignId === left.id).length;
      const rightUrls = allLinks.filter((link) => link.campaignId === right.id).length;
      const leftSignups = portal.downline.filter(
        (row) => row.level === 1 && row.campaignId === left.id,
      ).length;
      const rightSignups = portal.downline.filter(
        (row) => row.level === 1 && row.campaignId === right.id,
      ).length;
      if (tableQuery.sort === "urls") {
        return compareTableNum(leftUrls, rightUrls, tableQuery.dir);
      }
      if (tableQuery.sort === "signups") {
        return compareTableNum(leftSignups, rightSignups, tableQuery.dir);
      }
      if (tableQuery.sort === "status") {
        return compareTableText(
          left.archivedAt ? "archived" : "active",
          right.archivedAt ? "archived" : "active",
          tableQuery.dir,
        );
      }
      return compareTableText(left.name, right.name, tableQuery.dir);
    });
  const linkRows = allLinks
    .filter((link) => {
      if (!matchesAffiliateArchiveStatus(link.archivedAt, tableQuery.status)) {
        return false;
      }
      return matchesAffiliateNeedle(
        tableQuery.q,
        link.name,
        affiliateLandingLabel(link.landing),
        link.campaignName,
        affiliateLinkKindLabel(link.kind),
      );
    })
    .sort((left, right) => {
      if (tableQuery.sort === "landing") {
        return compareTableText(
          affiliateLandingLabel(left.landing),
          affiliateLandingLabel(right.landing),
          tableQuery.dir,
        );
      }
      if (tableQuery.sort === "campaign") {
        return compareTableText(
          left.campaignName ?? "",
          right.campaignName ?? "",
          tableQuery.dir,
        );
      }
      if (tableQuery.sort === "url") {
        return compareTableText(left.slug, right.slug, tableQuery.dir);
      }
      if (tableQuery.sort === "type") {
        return compareTableText(left.kind, right.kind, tableQuery.dir);
      }
      if (tableQuery.sort === "status") {
        return compareTableText(
          left.archivedAt ? "archived" : "active",
          right.archivedAt ? "archived" : "active",
          tableQuery.dir,
        );
      }
      return compareTableText(left.name, right.name, tableQuery.dir);
    });
  const payoutRows = [...payouts]
    .filter((payout) => {
      if (tableQuery.status && payout.status !== tableQuery.status) {
        return false;
      }
      return matchesAffiliateNeedle(
        tableQuery.q,
        payout.network ? chainName(payout.network) : "",
        payout.address,
        payoutStatusLabel(payout.status),
      );
    })
    .sort((left, right) => {
      if (tableQuery.sort === "amount") {
        return compareTableNum(left.amountUsd, right.amountUsd, tableQuery.dir);
      }
      if (tableQuery.sort === "chain") {
        return compareTableText(
          left.network ? chainName(left.network) : "",
          right.network ? chainName(right.network) : "",
          tableQuery.dir,
        );
      }
      if (tableQuery.sort === "address") {
        return compareTableText(left.address ?? "", right.address ?? "", tableQuery.dir);
      }
      if (tableQuery.sort === "status") {
        return compareTableText(left.status, right.status, tableQuery.dir);
      }
      if (tableQuery.sort === "paid") {
        return compareTableText(left.paidAt ?? "", right.paidAt ?? "", tableQuery.dir);
      }
      return compareTableText(left.createdAt, right.createdAt, tableQuery.dir);
    });
  const downlinePage = paginateAffiliateList(downlineRows, page);
  const commissionPage = paginateAffiliateList(commissionRows, page);
  const campaignPage = paginateAffiliateList(campaignRows, page);
  const linkPage = paginateAffiliateList(linkRows, page);
  const payoutPage = paginateAffiliateList(payoutRows, page);
  const defaultShareUrl = portal.code
    ? referralShareUrl(origin, portal.code)
    : "";

  return (
    <div>
      <PageHeading title="Affiliates" />
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
          URLs
        </TabLink>
        <TabLink href={affiliatePortalPath("referrals")} selected={tab === "referrals"}>
          Commissions
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
        <p className="mt-6 text-sm text-success">URL created.</p>
      ) : null}
      {saved === "campaign-archived" ? (
        <p className="mt-6 text-sm text-success">Campaign archived.</p>
      ) : null}
      {saved === "link-archived" ? (
        <p className="mt-6 text-sm text-success">URL archived.</p>
      ) : null}
      {saved === "link-renamed" ? (
        <p className="mt-6 text-sm text-success">URL renamed.</p>
      ) : null}
      {error ? (
        <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
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
            Signups stay yours even if they later click someone else’s URL.
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
            <div>
              <TableCard className="">
                <table className="w-full text-sm">
                  <thead className="border-b border-line bg-surface-raised text-left text-xs uppercase tracking-[0.12em] text-ink-faint">
                    <tr>
                      <th className="px-4 py-3 font-medium">Level</th>
                      <th className="px-4 py-3 font-medium">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portal.rates.rows.map((row) => (
                      <tr key={row.level} className="border-b border-line last:border-b-0">
                        <td className="px-4 py-3 text-ink">L{row.level}</td>
                        <td className="px-4 py-3 tabular-nums text-ink">
                          {row.active ? `${row.ratePct}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableCard>
              {platformMember ? (
                <Link
                  href="/account/plans"
                  className="mt-3 inline-flex rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
                >
                  Upgrade to earn higher rates
                </Link>
              ) : null}
            </div>
            <div className="rounded-card border border-line bg-surface p-5">
              <h2 className="text-lg font-semibold tracking-tight">
                Default URL
              </h2>
              <p className="mt-2 text-sm text-ink-muted">
                System Default. Share this. Custom landings are on the URLs
                tab.
              </p>
              {defaultShareUrl ? (
                <>
                  <div className="mt-4 flex items-center gap-2">
                    <p className="min-w-0 flex-1 break-all rounded-control border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink">
                      {defaultShareUrl}
                    </p>
                    <CopyTextButton text={defaultShareUrl} label="Copy URL" />
                  </div>
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
                href={affiliateNetworkPath("list", page, queryExtra)}
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
            portal.downline.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">No referrals yet.</p>
            ) : (
              <div className="mt-4">
                <AffiliateListFilters
                  tab="network"
                  query={tableQuery}
                  statusOptions={[
                    { value: "paid", label: "Paid" },
                    { value: "signup", label: "Signup" },
                  ]}
                />
                {downlinePage.total === 0 ? (
                  <p className="mt-4 text-sm text-ink-muted">No referrals match.</p>
                ) : (
                  <TableCard
                    className="mt-4"
                    pager={
                      <AffiliateTablePager
                        tab="network"
                        list={downlinePage}
                        extra={queryExtra}
                      />
                    }
                  >
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.12em] text-ink-faint">
                        <tr>
                          <AffiliateSortTh tab="network" query={tableQuery} label="Affiliate" sortKey="affiliate" />
                          <AffiliateSortTh tab="network" query={tableQuery} label="Plan" sortKey="plan" />
                          <AffiliateSortTh tab="network" query={tableQuery} label="Level" sortKey="level" />
                          <AffiliateSortTh tab="network" query={tableQuery} label="Status" sortKey="status" />
                          <AffiliateSortTh tab="network" query={tableQuery} label="To you" sortKey="toYou" />
                          <AffiliateSortTh tab="network" query={tableQuery} label="Joined" sortKey="joined" />
                        </tr>
                      </thead>
                      <tbody>
                        {downlinePage.rows.map((row) => {
                          const person = affiliateDownlinePersonMeta(
                            row,
                            portal.rates,
                          );
                          return (
                            <tr
                              key={row.userId}
                              id={`downline-${row.userId}`}
                              className="border-b border-line last:border-b-0"
                            >
                              <td className="px-4 py-3 text-ink">{row.label}</td>
                              <td className="px-4 py-3 text-ink">
                                {person.planLabel}
                              </td>
                              <td className="px-4 py-3 tabular-nums text-ink">
                                L{row.level}
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge
                                  label={row.firstPaidAt ? "Paid" : "Signup"}
                                  status={row.firstPaidAt ? "paid" : "signup"}
                                />
                              </td>
                              <td className="px-4 py-3 tabular-nums text-ink">
                                {person.runRateLabel}
                              </td>
                              <td className="px-4 py-3 text-ink-muted">
                  {monthJoinedLabel(row.attributedAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </TableCard>
                )}
              </div>
            )
          )}
        </div>
      ) : null}

      {tab === "referrals" ? (
        portal.commissions.length === 0 ? (
          <p className="mt-6 text-sm text-ink-muted">No commissions yet.</p>
        ) : (
          <div className="mt-6">
            <AffiliateListFilters
              tab="referrals"
              query={tableQuery}
              statusOptions={[
                { value: "pending", label: "Pending" },
                { value: "payable", label: "Payable" },
                { value: "paid", label: "Paid" },
                { value: "void", label: "Void" },
              ]}
            />
            {commissionPage.total === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">No commissions match.</p>
            ) : (
              <TableCard
                className="mt-4"
                pager={
                  <AffiliateTablePager
                    tab="referrals"
                    list={commissionPage}
                    extra={queryExtra}
                  />
                }
              >
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.12em] text-ink-faint">
                    <tr>
                      <AffiliateSortTh tab="referrals" query={tableQuery} label="Date" sortKey="date" />
                      <AffiliateSortTh tab="referrals" query={tableQuery} label="From" sortKey="from" />
                      <AffiliateSortTh tab="referrals" query={tableQuery} label="Level" sortKey="level" />
                      <AffiliateSortTh tab="referrals" query={tableQuery} label="Rate" sortKey="rate" />
                      <AffiliateSortTh tab="referrals" query={tableQuery} label="Amount" sortKey="amount" />
                      <AffiliateSortTh tab="referrals" query={tableQuery} label="Status" sortKey="status" />
                      <AffiliateSortTh tab="referrals" query={tableQuery} label="Hold until" sortKey="hold" />
                    </tr>
                  </thead>
                  <tbody>
                    {commissionPage.rows.map((row) => {
                      const created = parseDisplayTime(row.createdAt);
                      const hold = parseDisplayTime(row.holdUntil);
                      return (
                        <tr key={row.id} className="border-b border-line last:border-b-0">
                          <td className="px-4 py-3 text-ink-muted">
                            {created ? formatLocalDate(created) : "—"}
                          </td>
                          <td className="px-4 py-3 text-ink">
                            {sourceLabel(row.sourceUserId)}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-ink">
                            L{row.level}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-ink">
                            {row.ratePct}%
                          </td>
                          <td className="px-4 py-3 tabular-nums text-ink">
                            {formatUsd(row.amountUsd)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge label={row.status} status={row.status} />
                          </td>
                          <td className="px-4 py-3 text-ink-muted">
                            {hold ? formatLocalDate(hold) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableCard>
            )}
          </div>
        )
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
            {allCampaigns.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">No campaigns yet.</p>
            ) : (
              <>
                <AffiliateListFilters
                  tab="campaigns"
                  query={tableQuery}
                  statusOptions={[
                    { value: "active", label: "Active" },
                    { value: "archived", label: "Archived" },
                  ]}
                />
                {campaignPage.total === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">No campaigns match.</p>
                ) : (
                  <TableCard
                    className="mt-4"
                    pager={
                      <AffiliateTablePager
                        tab="campaigns"
                        list={campaignPage}
                        extra={queryExtra}
                      />
                    }
                  >
                    <AffiliateCampaignsTable
                      portal={portal}
                      campaigns={campaignPage.rows}
                      query={tableQuery}
                    />
                  </TableCard>
                )}
              </>
            )}
          </section>
        </div>
      ) : null}

      {tab === "links" ? (
        <div className="mt-6 space-y-5">
        <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold tracking-tight">
              Create a URL
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
                <AppSelect
                  name="landing"
                  defaultValue="home"
                  className={BILLING_FIELD_CLASS}
                >
                  {AFFILIATE_LANDINGS.map((landing) => (
                    <option key={landing} value={landing}>
                      {affiliateLandingLabel(landing)}
                    </option>
                  ))}
                </AppSelect>
              </label>
              <label className="min-w-[12rem] flex-1 text-sm text-ink">
                Campaign
                <AppSelect name="campaignId" defaultValue="" className={BILLING_FIELD_CLASS}>
                  <option value="">No campaign</option>
                  {portal.campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </AppSelect>
              </label>
              <PendingSubmitButton
                pendingLabel="Creating…"
                className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
              >
                Create URL
              </PendingSubmitButton>
            </form>
          </section>
          <section>
            <h2 className="text-lg font-semibold tracking-tight">Your URLs</h2>
            {allLinks.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">
                A referral code could not be created yet. Refresh and try again.
            </p>
          ) : (
              <>
                <AffiliateListFilters
                  tab="links"
                  query={tableQuery}
                  statusOptions={[
                    { value: "active", label: "Active" },
                    { value: "archived", label: "Archived" },
                  ]}
                />
                {linkPage.total === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">No URLs match.</p>
                ) : (
                  <TableCard
                    className="mt-4"
                    pager={
                      <AffiliateTablePager
                        tab="links"
                        list={linkPage}
                        extra={queryExtra}
                      />
                    }
                  >
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
                        <tr>
                          <AffiliateSortTh tab="links" query={tableQuery} label="Name" sortKey="name" />
                          <AffiliateSortTh tab="links" query={tableQuery} label="Landing" sortKey="landing" />
                          <AffiliateSortTh tab="links" query={tableQuery} label="Campaign" sortKey="campaign" />
                          <AffiliateSortTh tab="links" query={tableQuery} label="URL" sortKey="url" />
                          <AffiliateSortTh tab="links" query={tableQuery} label="Type" sortKey="type" />
                          <AffiliateSortTh tab="links" query={tableQuery} label="Status" sortKey="status" />
                          <th className={TABLE_ACTIONS_TH_CLASS}>
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
                  </TableCard>
                )}
              </>
          )}
        </section>
      </div>
      ) : null}

      {tab === "payouts" ? (
        <div className="mt-6 space-y-5">
          <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
            <section className="rounded-card border border-line bg-surface p-5 lg:col-span-2">
        <h2 className="text-lg font-semibold tracking-tight">
                Payout request
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
                Request USDT from payable earnings. Change chain and address on
                Settings.
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
                <input
                  type="hidden"
                  name="address"
                  value={portal.payoutSettings.address ?? ""}
                />
                <label className="w-44 shrink-0 text-sm text-ink">
            Chain
                  <AppSelect
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
                  </AppSelect>
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
                <div className="min-w-[10rem] text-sm text-ink">
                  Address
                  <p
                    className="mt-1 rounded-control border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink"
                    title={portal.payoutSettings.address ?? undefined}
                  >
                    {shortenPayoutAddress(portal.payoutSettings.address)}
                  </p>
                </div>
          <PendingSubmitButton
            pendingLabel="Requesting…"
            disabled={!canWithdraw}
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink disabled:bg-accent-strong/40"
          >
                  Request payout
          </PendingSubmitButton>
        </form>
            </section>
            <section className="rounded-card border border-line bg-surface p-5">
              <h2 className="text-lg font-semibold tracking-tight">
                Available
              </h2>
              <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight">
                {formatUsd(portal.payableUsd)}
              </p>
              <p className="mt-1 text-sm text-ink-muted">Payable</p>
              <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-line pt-3 text-sm">
                <p className="text-ink-muted">Auto payouts</p>
                <p className="text-right text-ink">
                  {portal.payoutSettings.autoPayout ? (
                    <>
                      On
                      {portal.payoutSettings.autoPayoutUsd != null ? (
                        <span className="mt-0.5 block text-hint text-ink-muted">
                          Over {formatUsd(portal.payoutSettings.autoPayoutUsd)}
                        </span>
        ) : null}
                    </>
                  ) : (
                    "Off"
                  )}
                </p>
              </div>
      </section>
          </div>
          <section>
            <h2 className="text-lg font-semibold tracking-tight">Payouts</h2>
            {payouts.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">No payouts yet.</p>
            ) : (
              <>
                <AffiliateListFilters
                  tab="payouts"
                  query={tableQuery}
                  statusOptions={[
                    { value: "requested", label: "Requested" },
                    { value: "approved", label: "Approved" },
                    { value: "pending", label: "Pending" },
                    { value: "rejected", label: "Rejected" },
                    { value: "paid", label: "Paid" },
                  ]}
                />
                {payoutPage.total === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">No payouts match.</p>
                ) : (
                  <TableCard
                    className="mt-4"
                    pager={
                      <AffiliateTablePager
                        tab="payouts"
                        list={payoutPage}
                        extra={queryExtra}
                      />
                    }
                  >
                    <AffiliatePayoutsTable
                      payouts={payoutPage.rows}
                      chainName={chainName}
                      query={tableQuery}
                    />
                  </TableCard>
                )}
              </>
            )}
          </section>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:items-start">
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
                <span className="mt-1 block text-hint text-ink-muted">
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
  query,
}: {
  payouts: PayoutRow[];
  chainName: (slug: string) => string;
  query: AffiliateListQuery;
}) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
        <tr>
          <AffiliateSortTh tab="payouts" query={query} label="Date" sortKey="date" />
          <AffiliateSortTh tab="payouts" query={query} label="Amount" sortKey="amount" />
          <AffiliateSortTh tab="payouts" query={query} label="Chain" sortKey="chain" />
          <AffiliateSortTh tab="payouts" query={query} label="Address" sortKey="address" />
          <AffiliateSortTh tab="payouts" query={query} label="Status" sortKey="status" />
          <AffiliateSortTh tab="payouts" query={query} label="Paid" sortKey="paid" />
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
                <td className="px-4 py-3 whitespace-nowrap text-ink">
                  {payout.network ? chainName(payout.network) : "—"}
                </td>
                <td
                  className="px-4 py-3 font-mono text-xs whitespace-nowrap text-ink-muted"
                  title={payout.address ?? undefined}
                >
                  {shortenPayoutAddress(payout.address)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge
                    label={payoutStatusLabel(payout.status)}
                    status={payout.status}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                  {paid ? formatLocalDate(paid) : "—"}
                </td>
              </tr>
            );
          })}
      </tbody>
    </table>
  );
}

function AffiliateCampaignsTable({
  portal,
  campaigns,
  query,
}: {
  portal: AffiliatePortal;
  campaigns: AffiliateCampaignRow[];
  query: AffiliateListQuery;
}) {
  const links = [...portal.links, ...portal.archivedLinks];
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
        <tr>
          <AffiliateSortTh tab="campaigns" query={query} label="Name" sortKey="name" />
          <AffiliateSortTh tab="campaigns" query={query} label="URLs" sortKey="urls" />
          <AffiliateSortTh tab="campaigns" query={query} label="Signups" sortKey="signups" />
          <AffiliateSortTh tab="campaigns" query={query} label="Status" sortKey="status" />
          <th className={TABLE_ACTIONS_TH_CLASS}>
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
      <td className="px-4 py-3 whitespace-nowrap">
        <StatusBadge
          label={archived ? "Archived" : "Active"}
          status={archived ? "archived" : "active"}
        />
      </td>
      <td className={TABLE_ACTIONS_TD_CLASS}>
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
            aria-label={`${link.name} share URL`}
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
      <td className="px-4 py-3 whitespace-nowrap">
        <StatusBadge
          label={archived ? "Archived" : "Active"}
          status={archived ? "archived" : "active"}
        />
      </td>
      <td className={TABLE_ACTIONS_TD_CLASS}>
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
  extra = {},
}: {
  tab: AffiliatePortalTab;
  list: {
    page: number;
    pageCount: number;
    total: number;
    from: number;
    to: number;
  };
  extra?: Record<string, string>;
}) {
  const prevHref =
    tab === "network"
      ? affiliateNetworkPath("list", list.page - 1, extra)
      : affiliatePortalPagePath(tab, list.page - 1, extra);
  const nextHref =
    tab === "network"
      ? affiliateNetworkPath("list", list.page + 1, extra)
      : affiliatePortalPagePath(tab, list.page + 1, extra);
  return (
    <TablePager window={list} prevHref={prevHref} nextHref={nextHref} />
  );
}

function AffiliateSortTh({
  tab,
  query,
  label,
  sortKey,
}: {
  tab: AffiliatePortalTab;
  query: AffiliateListQuery;
  label: string;
  sortKey: string;
}) {
  const defaults = affiliateListDefaults(tab);
  return (
    <SortTh
      label={label}
      active={query.sort === sortKey}
      dir={query.dir}
      href={tableSortHref({
        pathname: "/affiliates",
        params: affiliateListFilterParams(query, tab),
        key: sortKey,
        currentKey: query.sort,
        currentDir: query.dir,
        defaultKey: defaults.sort,
        defaultDir: defaults.dir,
      })}
    />
  );
}

function AffiliateListFilters({
  tab,
  query,
  statusOptions,
}: {
  tab: AffiliatePortalTab;
  query: AffiliateListQuery;
  statusOptions: { value: string; label: string }[];
}) {
  const defaults = affiliateListDefaults(tab);
  return (
    <TableFilterSession
      defaultOpen={Boolean(query.q.trim() || query.status)}
    >
        <LiveGetForm className="mt-4">
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="tab" value={tab} />
          {query.sort !== defaults.sort ? (
            <input type="hidden" name="sort" value={query.sort} />
          ) : null}
          {query.dir !== defaults.dir ? (
            <input type="hidden" name="dir" value={query.dir} />
          ) : null}
          <TableFilterField label="Search">
            <input
              name="q"
              defaultValue={query.q}
              className={TABLE_FILTER_FIELD_CLASS}
            />
          </TableFilterField>
          <TableFilterField label="Status">
            <AppSelect
              name="status"
              defaultValue={query.status}
              className={TABLE_FILTER_FIELD_CLASS}
            >
              <option value="">All</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AppSelect>
          </TableFilterField>
          <TableLabelButton
            href={affiliatePortalPath(tab)}
            variant="filter"
            icon={<IconFilterClear {...TABLE_BTN_ICON} />}
          >
            Clear
          </TableLabelButton>
        </LiveGetForm>
    </TableFilterSession>
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
