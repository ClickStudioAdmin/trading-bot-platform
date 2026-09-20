import type { Metadata } from "next";
import Link from "next/link";
import { SavedBillingMethodForm } from "@/components/billing-method-radios";
import { PageHeading } from "@/components/page-heading";
import { getSessionMember } from "@/lib/auth/session";
import { SortTh, StatusBadge, TableCard, TablePager } from "@/components/table-chrome";
import {
  billingMethodPriceNote,
  billingPath,
  billingTableQueryParams,
  DEFAULT_BILLING_INVOICE_SORT,
  DEFAULT_BILLING_LEDGER_SORT,
  DEFAULT_BILLING_TABLE_DIR,
  formatRemainingCycle,
  formatUsd,
  invoiceMethodLabel,
  hasUsableStripeSubscription,
  showManageCardForm,
  stripeCardExpiryLabel,
  stripeCardOnFileLabel,
  paginateBillingRows,
  parseBillingInvoiceSort,
  parseBillingLedgerSort,
  parseBillingPage,
  resolveBillingCycle,
} from "@/lib/membership/billing";
import {
  compareTableNum,
  compareTableText,
  tableSortHref,
} from "@/lib/table-chrome";
import { ManageSavedCard } from "@/components/manage-saved-card";
import { StripeSwitchToCard } from "@/components/stripe-embedded-checkout";
import {
  CryptoWalletPanel,
  LiveAccountBalanceSummary,
  LiveMainWallet,
  TopUpWallet,
} from "@/components/crypto-wallet-panel";
import {
  getMemberBilling,
  listMemberInvoices,
} from "@/lib/membership/billing-store";
import {
  creditedDepositsNotice,
  methodTopUpNote,
  showMemberLedgerTab,
  showMemberWalletTab,
} from "@/lib/membership/wallet";
import { invoiceStatusLabel } from "@/lib/membership/billing-cycle";
import {
  hasMainWalletLedger,
  listMainWalletLedger,
  loadMainWalletWithdrawContext,
  loadMemberDepositContext,
  pendingMainWithdrawUsd,
  walletBookBalances,
} from "@/lib/membership/wallet-store";
import { formatPlanPrice, planIsArchived } from "@/lib/membership/catalog";
import { getMembershipPlan } from "@/lib/membership/store";
import {
  loadStripeCardOnFile,
  stripePublishableConfigured,
  stripePublishableKey,
  stripeSecretConfigured,
} from "@/lib/membership/stripe";
import { NavBadge } from "@/components/nav-badge";
import {
  loadMemberNotificationChrome,
  memberBillingTabCounts,
} from "@/lib/notifications/badges";
import { firstSearchValue } from "@/lib/paper/open";
import { formatLocalDate, parseDisplayTime } from "@/lib/time/display";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Billing & Account",
  description: "Plan, payment method, wallets, and invoices.",
};

export default async function AccountBillingPage({
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
  const checkout = firstSearchValue(params.checkout);
  const upgraded = firstSearchValue(params.upgraded);
  const billing = await getMemberBilling(member.id);
  if (!billing) {
    redirect("/account/settings");
  }
  const deposited = firstSearchValue(params.deposited);
  const scanned = firstSearchValue(params.scanned) === "1";
  const [books, currentPlan, hasLedger, pendingWithdrawUsd] = await Promise.all([
    walletBookBalances(member.id),
    getMembershipPlan(billing.planId),
    hasMainWalletLedger(member.id),
    pendingMainWithdrawUsd(member.id),
  ]);
  const plan = currentPlan.ok ? currentPlan.plan : null;
  const showWalletTab = showMemberWalletTab(
    billing.billingMethod,
    books.main,
  );
  const showLedgerTab = showMemberLedgerTab(plan?.priceUsd ?? 0, hasLedger);
  const showPaymentMethod =
    Boolean(billing.billingMethod) && billing.subscriptionStatus !== "none";
  const requestedTab = firstSearchValue(params.tab);
  const tab =
    requestedTab === "invoices"
      ? "invoices"
      : (requestedTab === "method" || requestedTab === "card") &&
          showPaymentMethod
        ? "method"
        : requestedTab === "ledger" && showLedgerTab
          ? "ledger"
          : requestedTab === "wallet" && showWalletTab
              ? "wallet"
              : "overview";
  const [invoices, deposit, ledger, withdraw] = await Promise.all([
    tab === "invoices" ? listMemberInvoices(member.id) : Promise.resolve([]),
    tab === "wallet" ||
    (tab === "method" && billing.billingMethod === "wallet")
      ? loadMemberDepositContext(member.id)
      : Promise.resolve(null),
    tab === "ledger" ? listMainWalletLedger(member.id) : Promise.resolve([]),
    tab === "wallet"
      ? loadMainWalletWithdrawContext(member.id)
      : Promise.resolve(null),
  ]);
  const tablePage = parseBillingPage(firstSearchValue(params.page));
  const invoiceSort = parseBillingInvoiceSort({
    sort: firstSearchValue(params.sort),
    dir: firstSearchValue(params.dir),
  });
  const ledgerSort = parseBillingLedgerSort({
    sort: firstSearchValue(params.sort),
    dir: firstSearchValue(params.dir),
  });
  const invoicePage = paginateBillingRows(
    [...invoices].sort((left, right) => {
      if (invoiceSort.sort === "due") {
        return compareTableText(left.dueAt ?? "", right.dueAt ?? "", invoiceSort.dir);
      }
      if (invoiceSort.sort === "plan") {
        return compareTableText(left.planName, right.planName, invoiceSort.dir);
      }
      if (invoiceSort.sort === "method") {
        return compareTableText(
          invoiceMethodLabel(left.method),
          invoiceMethodLabel(right.method),
          invoiceSort.dir,
        );
      }
      if (invoiceSort.sort === "amount") {
        return compareTableNum(left.amountUsd, right.amountUsd, invoiceSort.dir);
      }
      if (invoiceSort.sort === "status") {
        return compareTableText(
          invoiceStatusLabel(left.status),
          invoiceStatusLabel(right.status),
          invoiceSort.dir,
        );
      }
      return compareTableText(left.createdAt, right.createdAt, invoiceSort.dir);
    }),
    tablePage,
  );
  const ledgerPage = paginateBillingRows(
    [...ledger].sort((left, right) => {
      if (ledgerSort.sort === "description") {
        return compareTableText(left.label, right.label, ledgerSort.dir);
      }
      if (ledgerSort.sort === "amount") {
        return compareTableNum(left.deltaUsd, right.deltaUsd, ledgerSort.dir);
      }
      if (ledgerSort.sort === "balance") {
        return compareTableNum(left.balanceUsd, right.balanceUsd, ledgerSort.dir);
      }
      return compareTableText(left.createdAt, right.createdAt, ledgerSort.dir);
    }),
    tablePage,
  );
  const cycle = resolveBillingCycle({ periodEnd: billing.periodEnd });
  const stripeReady = stripeSecretConfigured();
  const usableStripeSub = hasUsableStripeSubscription(billing);
  const cardOnFile =
    tab === "method" && billing.billingMethod === "stripe"
      ? await loadStripeCardOnFile(billing.stripeCustomerId)
      : null;
  const manageCard =
    tab === "method" &&
    billing.billingMethod === "stripe" &&
    (plan?.priceUsd ?? 0) >= 0.01
      ? showManageCardForm({
          hasUsableSubscription: usableStripeSub,
          hasCardOnFile: Boolean(cardOnFile),
        })
      : false;
  const chrome = await loadMemberNotificationChrome(
    member.id,
    member.platformMember,
  );
  const tabCounts = memberBillingTabCounts(chrome.actions);

  return (
    <div>
      <PageHeading title="Billing & Account" />
      <nav
        aria-label="Billing & Account"
        className="mt-5 flex flex-wrap border-b border-line"
      >
        <TabLink
          href="/account/billing"
          selected={tab === "overview"}
          count={tabCounts.overview}
        >
          Overview
        </TabLink>
        <TabLink
          href="/account/billing?tab=invoices"
          selected={tab === "invoices"}
          count={tabCounts.invoices}
        >
          Invoices
        </TabLink>
        {showPaymentMethod ? (
          <TabLink
            href="/account/billing?tab=method"
            selected={tab === "method"}
            count={tabCounts.method}
          >
            Manage Payment Method
          </TabLink>
        ) : null}
        {showWalletTab ? (
          <TabLink
            href="/account/billing?tab=wallet"
            selected={tab === "wallet"}
            count={tabCounts.wallet}
          >
            Manage Account Balance
          </TabLink>
        ) : null}
        {showLedgerTab ? (
          <TabLink
            href="/account/billing?tab=ledger"
            selected={tab === "ledger"}
            count={tabCounts.ledger}
          >
            Account Ledger
          </TabLink>
        ) : null}
      </nav>
      {error ? (
        <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved === "method" ? (
        <p className="mt-6 text-sm text-success">Payment method saved.</p>
      ) : null}
      {saved === "card" ? (
        <p className="mt-6 text-sm text-success">Card details saved.</p>
      ) : null}
      {saved === "withdraw" ? (
        <p className="mt-6 text-sm text-success">
          Withdraw requested. It will go out on the next payout list.
        </p>
      ) : null}
      {upgraded === "1" ? (
        <p className="mt-6 text-sm text-success">
          Subscription update sent to Stripe. This page refreshes when the
          webhook confirms.
        </p>
      ) : null}
      {upgraded === "wallet" ? (
        <p className="mt-6 text-sm text-success">
          Plan paid from your account.
        </p>
      ) : null}
      {deposited ? (
        <p className="mt-6 text-sm text-success">
          {creditedDepositsNotice(Number(deposited))}
        </p>
      ) : null}
      {scanned ? (
        <p className="mt-6 text-sm text-ink-muted">
          No new confirmed deposits in the recent window.
        </p>
      ) : null}
      {checkout === "success" ? (
        <p className="mt-6 text-sm text-success">
          Checkout received. Plan and invoices update when Stripe confirms.
        </p>
      ) : null}
      {checkout === "cancel" ? (
        <p className="mt-6 text-sm text-ink-muted">Checkout canceled.</p>
      ) : null}
      {!stripeReady && tab === "method" && showPaymentMethod ? (
        <p className="mt-6 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Stripe test keys are not on this environment yet. You can still
          choose a payment method.
        </p>
      ) : null}

      {tab === "overview" ? (
        <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">
            Subscription Details
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                Current plan
              </p>
              <p className="mt-1 text-sm text-ink">
                {plan?.name ?? "—"}
                {planIsArchived(plan ?? { archivedAt: null })
                  ? " · Legacy"
                  : ""}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.12em] text-ink-muted">
                Monthly payment
              </p>
              <p className="mt-1 text-sm text-ink">
                {plan ? formatPlanPrice(plan.priceUsd) : "—"}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.12em] text-ink-muted">
                Payment method
              </p>
              <p className="mt-1 text-sm text-ink">
                {billingMethodPriceNote(billing.billingMethod)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                Billing cycle
              </p>
              {!plan || plan.priceUsd < 0.01 ? (
                <p className="mt-1 text-sm text-ink">NA</p>
              ) : cycle ? (
                <p className="mt-1 text-sm text-ink">
                  {formatLocalDate(cycle.startMs)} –{" "}
                  {formatLocalDate(cycle.endMs)}
                </p>
              ) : (
                <p className="mt-1 text-sm text-ink-muted">No end date set.</p>
              )}
              <p className="mt-3 text-xs uppercase tracking-[0.12em] text-ink-muted">
                Next payment due
              </p>
              <p className="mt-1 text-sm text-ink">
                {!plan || plan.priceUsd < 0.01
                  ? "Not required"
                  : cycle
                    ? `${formatLocalDate(cycle.endMs)} · ${formatRemainingCycle(cycle.remainingMs)}`
                    : "No end date set."}
              </p>
              <div className="mt-4">
                <Link
                  href="/account/plans"
                  className="inline-flex rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent"
                >
                  Upgrade
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="rounded-card border border-line bg-surface p-5">
          <LiveMainWallet
            initialMainUsd={books.main}
            initialPendingWithdrawUsd={pendingWithdrawUsd}
            pollBalance
          >
            <h2 className="text-lg font-semibold tracking-tight">
              Account Balance
            </h2>
            <LiveAccountBalanceSummary cycleDueUsd={plan?.priceUsd ?? 0} />
            <p className="mt-4">
              <Link
                href={billingPath({ tab: "wallet" })}
                className="text-sm text-accent hover:text-accent-strong"
              >
                Manage Account Balance
              </Link>
            </p>
          </LiveMainWallet>
        </section>
        </div>
      ) : tab === "method" ? (
        <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold tracking-tight">
              Current payment method
            </h2>
            <SavedBillingMethodForm
              selected={billing.billingMethod}
              deductSelected={
                billing.paySubscriptionFromAffiliate ||
                billing.paySubscriptionFromCredit
              }
              hasStripeSubscription={usableStripeSub || manageCard}
            />
          </section>
          {billing.billingMethod === "stripe" &&
          (plan?.priceUsd ?? 0) >= 0.01 ? (
            <section className="overflow-hidden rounded-card border border-line bg-surface p-5">
              {!stripeReady || !stripePublishableConfigured() ? (
                <p className="text-sm text-warning">
                  Stripe is not configured on this environment.
                </p>
              ) : manageCard ? (
                <ManageSavedCard
                  cardLabel={
                    cardOnFile
                      ? stripeCardOnFileLabel(cardOnFile)
                      : "Card on file"
                  }
                  expiryLabel={
                    cardOnFile ? stripeCardExpiryLabel(cardOnFile) : null
                  }
                  publishableKey={stripePublishableKey()}
                />
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-ink-muted">
                    Enter your card to start automatic Stripe payments. This
                    cycle stays paid; Stripe charges from the next renewal.
                  </p>
                  <StripeSwitchToCard
                    publishableKey={stripePublishableKey()}
                  />
                </div>
              )}
            </section>
          ) : billing.billingMethod === "wallet" ? (
            <section className="rounded-card border border-line bg-surface p-5">
              <LiveMainWallet
                initialMainUsd={deposit?.books.main ?? 0}
                initialPendingWithdrawUsd={pendingWithdrawUsd}
                pollBalance
              >
                <TopUpWallet
                  address={deposit?.address ?? null}
                  addressError={deposit?.addressError ?? null}
                  chains={deposit?.chains ?? []}
                  tokens={deposit?.tokens ?? []}
                  heading="Top up Account Balance"
                  instructions={methodTopUpNote(plan?.priceUsd ?? 0)}
                  cycleDueUsd={plan?.priceUsd ?? 0}
                />
              </LiveMainWallet>
            </section>
          ) : null}
        </div>
      ) : tab === "wallet" ? (
        <LiveMainWallet
          initialMainUsd={deposit?.books.main ?? 0}
          initialPendingWithdrawUsd={pendingWithdrawUsd}
          pollBalance
        >
          <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
              <section className="rounded-card border border-line bg-surface p-5">
                <CryptoWalletPanel
                  mainUsd={deposit?.books.main ?? 0}
                  affiliateUsd={deposit?.payableAffiliateUsd ?? 0}
                  address={deposit?.address ?? null}
                  addressError={deposit?.addressError ?? null}
                  chains={deposit?.chains ?? []}
                  tokens={deposit?.tokens ?? []}
                  deductOn={billing.paySubscriptionFromCredit}
                  affiliateNote={billing.paySubscriptionFromAffiliate}
                  booksOnly
                  hideBalance
                  withdraw={withdraw ?? undefined}
                />
              </section>
              <section className="rounded-card border border-line bg-surface p-5">
                <TopUpWallet
                  address={deposit?.address ?? null}
                  addressError={deposit?.addressError ?? null}
                  chains={deposit?.chains ?? []}
                  tokens={deposit?.tokens ?? []}
                  heading="Top up Account Balance"
                  instructions={methodTopUpNote(plan?.priceUsd ?? 0)}
                  cycleDueUsd={plan?.priceUsd ?? 0}
                  revealAddress={billing.billingMethod === "wallet"}
                />
              </section>
          </div>
        </LiveMainWallet>
      ) : tab === "ledger" ? (
      ledgerPage.total === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">No Account Balance activity yet.</p>
      ) : (
        <TableCard
          pager={
            <BillingTablePager tab="ledger" list={ledgerPage} sort={ledgerSort} />
          }
        >
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-ink-faint">
                <tr>
                  <SortTh
                    label="Date"
                    active={ledgerSort.sort === "date"}
                    dir={ledgerSort.dir}
                    href={tableSortHref({
                      pathname: "/account/billing",
                      params: { tab: "ledger" },
                      key: "date",
                      currentKey: ledgerSort.sort,
                      currentDir: ledgerSort.dir,
                      defaultKey: DEFAULT_BILLING_LEDGER_SORT,
                      defaultDir: DEFAULT_BILLING_TABLE_DIR,
                    })}
                  />
                  <SortTh
                    label="Description"
                    active={ledgerSort.sort === "description"}
                    dir={ledgerSort.dir}
                    href={tableSortHref({
                      pathname: "/account/billing",
                      params: { tab: "ledger" },
                      key: "description",
                      currentKey: ledgerSort.sort,
                      currentDir: ledgerSort.dir,
                      defaultKey: DEFAULT_BILLING_LEDGER_SORT,
                      defaultDir: DEFAULT_BILLING_TABLE_DIR,
                    })}
                  />
                  <SortTh
                    label="Amount"
                    active={ledgerSort.sort === "amount"}
                    dir={ledgerSort.dir}
                    href={tableSortHref({
                      pathname: "/account/billing",
                      params: { tab: "ledger" },
                      key: "amount",
                      currentKey: ledgerSort.sort,
                      currentDir: ledgerSort.dir,
                      defaultKey: DEFAULT_BILLING_LEDGER_SORT,
                      defaultDir: DEFAULT_BILLING_TABLE_DIR,
                    })}
                  />
                  <SortTh
                    label="Balance"
                    active={ledgerSort.sort === "balance"}
                    dir={ledgerSort.dir}
                    href={tableSortHref({
                      pathname: "/account/billing",
                      params: { tab: "ledger" },
                      key: "balance",
                      currentKey: ledgerSort.sort,
                      currentDir: ledgerSort.dir,
                      defaultKey: DEFAULT_BILLING_LEDGER_SORT,
                      defaultDir: DEFAULT_BILLING_TABLE_DIR,
                    })}
                  />
                </tr>
              </thead>
              <tbody>
                {ledgerPage.rows.map((row) => {
                  const created = parseDisplayTime(row.createdAt);
                  const credit = row.deltaUsd >= 0;
                  return (
                    <tr key={row.id} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                        {created ? formatLocalDate(created) : "—"}
                      </td>
                      <td className="px-4 py-3 text-ink">{row.label}</td>
                      <td
                        className={`px-4 py-3 tabular-nums ${
                          credit ? "text-success" : "text-danger"
                        }`}
                      >
                        {credit ? "+" : "−"}
                        {formatUsd(Math.abs(row.deltaUsd))}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-ink">
                        {formatUsd(row.balanceUsd)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </TableCard>
      )
      ) : invoicePage.total === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">No invoices yet.</p>
      ) : (
        <TableCard
          pager={
            <BillingTablePager
              tab="invoices"
              list={invoicePage}
              sort={invoiceSort}
            />
          }
        >
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-ink-faint">
                <tr>
                  <SortTh
                    label="Issued"
                    active={invoiceSort.sort === "issued"}
                    dir={invoiceSort.dir}
                    href={tableSortHref({
                      pathname: "/account/billing",
                      params: { tab: "invoices" },
                      key: "issued",
                      currentKey: invoiceSort.sort,
                      currentDir: invoiceSort.dir,
                      defaultKey: DEFAULT_BILLING_INVOICE_SORT,
                      defaultDir: DEFAULT_BILLING_TABLE_DIR,
                    })}
                  />
                  <SortTh
                    label="Due"
                    active={invoiceSort.sort === "due"}
                    dir={invoiceSort.dir}
                    href={tableSortHref({
                      pathname: "/account/billing",
                      params: { tab: "invoices" },
                      key: "due",
                      currentKey: invoiceSort.sort,
                      currentDir: invoiceSort.dir,
                      defaultKey: DEFAULT_BILLING_INVOICE_SORT,
                      defaultDir: DEFAULT_BILLING_TABLE_DIR,
                    })}
                  />
                  <SortTh
                    label="Plan"
                    active={invoiceSort.sort === "plan"}
                    dir={invoiceSort.dir}
                    href={tableSortHref({
                      pathname: "/account/billing",
                      params: { tab: "invoices" },
                      key: "plan",
                      currentKey: invoiceSort.sort,
                      currentDir: invoiceSort.dir,
                      defaultKey: DEFAULT_BILLING_INVOICE_SORT,
                      defaultDir: DEFAULT_BILLING_TABLE_DIR,
                    })}
                  />
                  <SortTh
                    label="Method"
                    active={invoiceSort.sort === "method"}
                    dir={invoiceSort.dir}
                    href={tableSortHref({
                      pathname: "/account/billing",
                      params: { tab: "invoices" },
                      key: "method",
                      currentKey: invoiceSort.sort,
                      currentDir: invoiceSort.dir,
                      defaultKey: DEFAULT_BILLING_INVOICE_SORT,
                      defaultDir: DEFAULT_BILLING_TABLE_DIR,
                    })}
                  />
                  <SortTh
                    label="Amount"
                    active={invoiceSort.sort === "amount"}
                    dir={invoiceSort.dir}
                    href={tableSortHref({
                      pathname: "/account/billing",
                      params: { tab: "invoices" },
                      key: "amount",
                      currentKey: invoiceSort.sort,
                      currentDir: invoiceSort.dir,
                      defaultKey: DEFAULT_BILLING_INVOICE_SORT,
                      defaultDir: DEFAULT_BILLING_TABLE_DIR,
                    })}
                  />
                  <SortTh
                    label="Status"
                    active={invoiceSort.sort === "status"}
                    dir={invoiceSort.dir}
                    href={tableSortHref({
                      pathname: "/account/billing",
                      params: { tab: "invoices" },
                      key: "status",
                      currentKey: invoiceSort.sort,
                      currentDir: invoiceSort.dir,
                      defaultKey: DEFAULT_BILLING_INVOICE_SORT,
                      defaultDir: DEFAULT_BILLING_TABLE_DIR,
                    })}
                  />
                </tr>
              </thead>
              <tbody>
                {invoicePage.rows.map((invoice) => {
                  const created = parseDisplayTime(invoice.createdAt);
                  const due = parseDisplayTime(invoice.dueAt);
                  return (
                    <tr key={invoice.id} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-3 text-ink-muted">
                        {created ? formatLocalDate(created) : "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {due ? formatLocalDate(due) : "—"}
                      </td>
                      <td className="px-4 py-3 text-ink">{invoice.planName}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        {invoiceMethodLabel(invoice.method)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-ink">
                        {formatUsd(invoice.amountUsd)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={invoiceStatusLabel(invoice.status)}
                          status={invoiceStatusLabel(invoice.status)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </TableCard>
      )}
    </div>
  );
}

function BillingTablePager({
  tab,
  list,
  sort,
}: {
  tab: "invoices" | "ledger";
  list: {
    page: number;
    pageCount: number;
    total: number;
    from: number;
    to: number;
  };
  sort: { sort: string; dir: "asc" | "desc" };
}) {
  const extra = billingTableQueryParams(sort, {
    sort:
      tab === "invoices"
        ? DEFAULT_BILLING_INVOICE_SORT
        : DEFAULT_BILLING_LEDGER_SORT,
    dir: DEFAULT_BILLING_TABLE_DIR,
  });
  return (
    <TablePager
      window={list}
      prevHref={billingPath({
        tab,
        page: list.page > 2 ? String(list.page - 1) : undefined,
        ...extra,
      })}
      nextHref={billingPath({
        tab,
        page: String(list.page + 1),
        ...extra,
      })}
    />
  );
}

function TabLink({
  href,
  selected,
  count = 0,
  children,
}: {
  href: string;
  selected: boolean;
  count?: number;
  children: string;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm ${
        selected
          ? "border-accent text-ink"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {children}
      <NavBadge count={count} />
    </Link>
  );
}
