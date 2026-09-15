import type { Metadata } from "next";
import Link from "next/link";
import { SavedBillingMethodForm } from "@/components/billing-method-radios";
import { PageHeading } from "@/components/page-heading";
import { getSessionMember } from "@/lib/auth/session";
import {
  billingMethodPriceNote,
  billingPageLabel,
  billingPath,
  formatRemainingCycle,
  formatUsd,
  invoiceMethodLabel,
  hasUsableStripeSubscription,
  showManageCardForm,
  paginateBillingRows,
  parseBillingPage,
  resolveBillingCycle,
} from "@/lib/membership/billing";
import {
  StripeEmbeddedCard,
  StripeSwitchToCard,
} from "@/components/stripe-embedded-checkout";
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
  walletBookBalances,
} from "@/lib/membership/wallet-store";
import { formatPlanPrice, planIsArchived } from "@/lib/membership/catalog";
import { getMembershipPlan } from "@/lib/membership/store";
import {
  stripeCustomerHasCard,
  stripePublishableConfigured,
  stripePublishableKey,
  stripeSecretConfigured,
} from "@/lib/membership/stripe";
import { firstSearchValue } from "@/lib/paper/open";
import { formatLocalDate, parseDisplayTime } from "@/lib/time/display";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Billing & Account Balance",
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
  const [books, currentPlan, hasLedger] = await Promise.all([
    walletBookBalances(member.id),
    getMembershipPlan(billing.planId),
    hasMainWalletLedger(member.id),
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
  const invoicePage = paginateBillingRows(invoices, tablePage);
  const ledgerPage = paginateBillingRows(ledger, tablePage);
  const cycle = resolveBillingCycle({ periodEnd: billing.periodEnd });
  const stripeReady = stripeSecretConfigured();
  const usableStripeSub = hasUsableStripeSubscription(billing);
  const manageCard =
    tab === "method" &&
    billing.billingMethod === "stripe" &&
    (plan?.priceUsd ?? 0) >= 0.01
      ? showManageCardForm({
          hasUsableSubscription: usableStripeSub,
          hasCardOnFile: usableStripeSub
            ? true
            : await stripeCustomerHasCard(billing.stripeCustomerId),
        })
      : false;

  return (
    <div>
      <PageHeading title="Billing & Account Balance" />
      <p className="-mt-4 max-w-2xl text-sm text-ink-muted">
        One collection method per login. Card uses the on-site Stripe form.
        Crypto is a payment method: listed stables credit your account 1:1 as
        USD. You can optionally deduct that credit first. Compare plans
        on{" "}
        <Link href="/account/plans" className="text-accent">
          Plans
        </Link>
        .
      </p>
      <nav
        aria-label="Billing & Account Balance"
        className="mt-5 flex border-b border-line"
      >
        <TabLink href="/account/billing" selected={tab === "overview"}>
          Overview
        </TabLink>
        <TabLink
          href="/account/billing?tab=invoices"
          selected={tab === "invoices"}
        >
          Invoices
        </TabLink>
        {showPaymentMethod ? (
          <TabLink
            href="/account/billing?tab=method"
            selected={tab === "method"}
          >
            Manage Payment Method
          </TabLink>
        ) : null}
        {showWalletTab ? (
          <TabLink
            href="/account/billing?tab=wallet"
            selected={tab === "wallet"}
          >
            Manage Account Balance
          </TabLink>
        ) : null}
        {showLedgerTab ? (
          <TabLink
            href="/account/billing?tab=ledger"
            selected={tab === "ledger"}
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
          <LiveMainWallet initialMainUsd={books.main} pollBalance>
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
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold tracking-tight">
                    Manage card
                  </h2>
                  <p className="text-sm text-ink-muted">
                    Update the card Stripe charges. You stay on this page.
                  </p>
                  <StripeEmbeddedCard
                    publishableKey={stripePublishableKey()}
                  />
                </div>
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
      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Account Ledger</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Running Account Balance activity: deposits, plan payments, withdrawals,
          and transfers from Affiliate when you deduct from earnings.
        </p>
        {ledgerPage.total === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No Account Balance activity yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Description</th>
                  <th className="pb-2 pr-4 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ledgerPage.rows.map((row) => {
                  const created = parseDisplayTime(row.createdAt);
                  const credit = row.deltaUsd >= 0;
                  return (
                    <tr key={row.id}>
                      <td className="py-2 pr-4 whitespace-nowrap text-ink-muted">
                        {created ? formatLocalDate(created) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-ink">{row.label}</td>
                      <td
                        className={`py-2 pr-4 tabular-nums ${
                          credit ? "text-success" : "text-danger"
                        }`}
                      >
                        {credit ? "+" : "−"}
                        {formatUsd(Math.abs(row.deltaUsd))}
                      </td>
                      <td className="py-2 tabular-nums text-ink">
                        {formatUsd(row.balanceUsd)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <BillingTablePager
              tab="ledger"
              list={ledgerPage}
            />
          </div>
        )}
      </section>
      ) : (
      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Invoices</h2>
        {invoicePage.total === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No invoices yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Issued</th>
                  <th className="pb-2 pr-4 font-medium">Due</th>
                  <th className="pb-2 pr-4 font-medium">Plan</th>
                  <th className="pb-2 pr-4 font-medium">Method</th>
                  <th className="pb-2 pr-4 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invoicePage.rows.map((invoice) => {
                  const created = parseDisplayTime(invoice.createdAt);
                  const due = parseDisplayTime(invoice.dueAt);
                  return (
                    <tr key={invoice.id}>
                      <td className="py-2 pr-4 text-ink-muted">
                        {created ? formatLocalDate(created) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-ink-muted">
                        {due ? formatLocalDate(due) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-ink">{invoice.planName}</td>
                      <td className="py-2 pr-4 text-ink-muted">
                        {invoiceMethodLabel(invoice.method)}
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-ink">
                        {formatUsd(invoice.amountUsd)}
                      </td>
                      <td className="py-2 text-ink-muted">
                        {invoiceStatusLabel(invoice.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <BillingTablePager
              tab="invoices"
              list={invoicePage}
            />
          </div>
        )}
      </section>
      )}
    </div>
  );
}

function BillingTablePager({
  tab,
  list,
}: {
  tab: "invoices" | "ledger";
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
      <p>{billingPageLabel(list)}</p>
      {list.pageCount > 1 ? (
        <div className="flex gap-2">
          {list.page > 1 ? (
            <Link
              href={billingPath({
                tab,
                page: list.page > 2 ? String(list.page - 1) : undefined,
              })}
              className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Previous
            </Link>
          ) : null}
          {list.page < list.pageCount ? (
            <Link
              href={billingPath({ tab, page: String(list.page + 1) })}
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
