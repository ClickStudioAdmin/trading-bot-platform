"use client";

import { useState, type FormEvent } from "react";
import { PageHeading } from "@/components/page-heading";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";

const primaryBtn =
  "rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent";

export function ThemeFormDraft() {
  const [notice, setNotice] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("Sample only — this form is not submitted.");
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:items-start">
      <div>
        <PageHeading title="Join for Free" className="mb-6" />
        <p className="-mt-4 max-w-2xl text-sm text-ink-muted">
          It is free to open a platform account. Confirm your email, then
          create desks, paper trade on live marks, or bind a trade-only
          exchange key when you are ready. Upgrade later for more platform
          features and higher affiliate commissions. Every member is already
          an affiliate.
        </p>
        <ul className="mt-6 max-w-xl list-disc space-y-2 pl-5 text-sm text-ink-muted">
          <li>
            Paper uses public marks and the in-app ledger. Live binds a
            trade-only key from this login.
          </li>
          <li>
            Cash and Carry, Perps, Perps bots, TradingView Strategy, and DCA.
            Type is set at create.
          </li>
          <li>
            Share a referral code from day one. Commission is on membership
            subscriptions, not trading PnL.
          </li>
        </ul>
      </div>
      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">
          Create a Free account
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Confirm your email to get started.
        </p>
        {notice ? (
          <p className="mt-4 rounded-card border border-line bg-surface-raised px-4 py-3 text-sm text-ink-muted">
            {notice}
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block text-sm text-ink" htmlFor="theme-form-name">
            Name
            <input
              id="theme-form-name"
              name="name"
              required
              maxLength={80}
              autoComplete="off"
              className={BILLING_FIELD_CLASS}
            />
          </label>
          <label className="block text-sm text-ink" htmlFor="theme-form-email">
            Email
            <input
              id="theme-form-email"
              name="email"
              type="email"
              required
              autoComplete="off"
              className={BILLING_FIELD_CLASS}
            />
          </label>
          <label
            className="block text-sm text-ink"
            htmlFor="theme-form-password"
          >
            Password
            <input
              id="theme-form-password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="off"
              className={BILLING_FIELD_CLASS}
            />
            <span className="mt-1 block text-xs text-ink-muted">
              At least 8 characters.
            </span>
          </label>
          <label
            className="block text-sm text-ink"
            htmlFor="theme-form-referral"
          >
            Referral code
            <input
              id="theme-form-referral"
              name="referralCode"
              defaultValue="SAMPLE"
              autoComplete="off"
              className={BILLING_FIELD_CLASS}
            />
            <span className="mt-1 block text-xs text-ink-muted">
              Optional. Use a code if someone referred you.
            </span>
          </label>
          <button type="submit" className={primaryBtn}>
            Create free account
          </button>
        </form>
        <p className="mt-4 text-sm text-ink-muted">
          Already have an account?{" "}
          <span className="text-accent">Sign in</span>.
        </p>
      </section>
    </div>
  );
}
