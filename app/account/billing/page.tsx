import type { Metadata } from "next";
import Link from "next/link";
import { BillingMethodRadios } from "@/components/billing-method-radios";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getSessionMember } from "@/lib/auth/session";
import {
  SUBSCRIPTION_STATUS_LABELS,
  formatUsd,
} from "@/lib/membership/billing";
import {
  openCustomerPortalAction,
  setBillingMethodAction,
} from "@/lib/membership/billing-actions";
import {
  CryptoWalletPanel,
  TopUpWallet,
} from "@/components/crypto-wallet-panel";
import {
  getMemberBilling,
  listMemberInvoices,
} from "@/lib/membership/billing-store";
import { loadMemberDepositContext } from "@/lib/membership/wallet-store";
import { formatPlanPrice, planIsArchived } from "@/lib/membership/catalog";
import { getMembershipPlan } from "@/lib/membership/store";
import { stripeSecretConfigured } from "@/lib/membership/stripe";
import { firstSearchValue } from "@/lib/paper/open";
import { formatLocalDate, parseDisplayTime } from "@/lib/time/display";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Billing and Wallets",
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
  const tab =
    firstSearchValue(params.tab) === "invoices" ? "invoices" : "overview";
  const [currentPlan, invoices, deposit] = await Promise.all([
    tab === "overview"
      ? getMembershipPlan(billing.planId)
      : Promise.resolve(null),
    tab === "invoices" ? listMemberInvoices(member.id) : Promise.resolve([]),
    tab === "overview"
      ? loadMemberDepositContext(member.id)
      : Promise.resolve(null),
  ]);
  const plan = currentPlan?.ok ? currentPlan.plan : null;
  const periodMs = parseDisplayTime(billing.periodEnd);
  const stripeReady = stripeSecretConfigured();

  return (
    <div>
      <PageHeading title="Billing and Wallets" />
      <p className="-mt-4 max-w-2xl text-sm text-ink-muted">
        One collection method per login. Card uses the on-site Stripe form.
        Crypto can optionally deduct Main Wallet credit first. Compare plans
        on{" "}
        <Link href="/account/plans" className="text-accent">
          Plans
        </Link>
        .
      </p>
      <nav
        aria-label="Billing and Wallets"
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
      </nav>
      {error ? (
        <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved === "method" ? (
        <p className="mt-6 text-sm text-success">Payment method saved.</p>
      ) : null}
      {upgraded === "1" ? (
        <p className="mt-6 text-sm text-success">
          Subscription update sent to Stripe. This page refreshes when the
          webhook confirms.
        </p>
      ) : null}
      {upgraded === "wallet" ? (
        <p className="mt-6 text-sm text-success">
          Plan paid from Main Wallet credit.
        </p>
      ) : null}
      {deposited ? (
        <p className="mt-6 text-sm text-success">
          Credited {deposited} deposit{deposited === "1" ? "" : "s"} to Main.
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
      {!stripeReady && tab === "overview" ? (
        <p className="mt-6 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Stripe test keys are not on this environment yet. You can still
          choose a payment method.
        </p>
      ) : null}

      {tab === "overview" ? (
        <>
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">Current plan</h2>
          <p className="mt-3 text-sm text-ink">{plan?.name ?? "—"}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {plan ? formatPlanPrice(plan.priceUsd) : ""}
            {planIsArchived(plan ?? { archivedAt: null }) ? " · Legacy" : ""}
          </p>
          <p className="mt-2 text-xs text-ink-faint">
            Status: {SUBSCRIPTION_STATUS_LABELS[billing.subscriptionStatus]}
            {periodMs ? ` · Period ends ${formatLocalDate(periodMs)}` : ""}
          </p>
          <div className="mt-4">
            <Link
              href="/account/plans"
              className="inline-flex rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent"
            >
              Upgrade
            </Link>
          </div>
        </section>

        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">
            Payment method
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Card charges Stripe. Crypto is the collection method. Deduct from
            Main Wallet credit is optional.
          </p>
          <form action={setBillingMethodAction} className="mt-4 space-y-4">
            <BillingMethodRadios
              name="billingMethod"
              selected={billing.billingMethod}
              deductSelected={billing.paySubscriptionFromCredit}
            />
            <div className="flex flex-wrap gap-3">
              <PendingSubmitButton
                pendingLabel="Saving…"
                successKey="save-billing-method"
                className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
              >
                Save method
              </PendingSubmitButton>
              {billing.stripeCustomerId ? (
                <PendingSubmitButton
                  formAction={openCustomerPortalAction}
                  pendingLabel="Opening…"
                  className="rounded-control border border-line px-4 py-2 text-sm text-ink hover:border-line-strong"
                >
                  Manage card
                </PendingSubmitButton>
              ) : null}
            </div>
          </form>
        </section>
      </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-5">
          <CryptoWalletPanel
            mainUsd={deposit?.books.main ?? 0}
            affiliateUsd={deposit?.books.affiliate ?? 0}
            address={deposit?.address ?? null}
            addressError={deposit?.addressError ?? null}
            chains={deposit?.chains ?? []}
            tokens={deposit?.tokens ?? []}
            deductOn={billing.paySubscriptionFromCredit}
            affiliateNote={billing.paySubscriptionFromAffiliate}
            booksOnly
          />
        </section>
        <section className="rounded-card border border-line bg-surface p-5">
          <TopUpWallet
            address={deposit?.address ?? null}
            addressError={deposit?.addressError ?? null}
            chains={deposit?.chains ?? []}
            tokens={deposit?.tokens ?? []}
          />
        </section>
      </div>
        </>
      ) : (
      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No invoices yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Plan</th>
                  <th className="pb-2 pr-4 font-medium">Method</th>
                  <th className="pb-2 pr-4 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invoices.map((invoice) => {
                  const created = parseDisplayTime(invoice.createdAt);
                  return (
                    <tr key={invoice.id}>
                      <td className="py-2 pr-4 text-ink-muted">
                        {created ? formatLocalDate(created) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-ink">{invoice.planName}</td>
                      <td className="py-2 pr-4 text-ink-muted capitalize">
                        {invoice.method}
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-ink">
                        {formatUsd(invoice.amountUsd)}
                      </td>
                      <td className="py-2 capitalize text-ink-muted">
                        {invoice.status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}
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
