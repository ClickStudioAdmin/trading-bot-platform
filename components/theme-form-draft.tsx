"use client";

import { useState, type FormEvent } from "react";
import { AppMultiSelect, AppSelect } from "@/components/app-select";
import { AppCheck, AppRadio } from "@/components/app-check";
import { HintLabel } from "@/components/bot-form-chrome";
import { DatePicker } from "@/components/date-picker";
import { LogoFileField } from "@/components/logo-file-field";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";

const fieldClass = BILLING_FIELD_CLASS;
const invalidClass =
  "mt-1 w-full min-w-0 rounded-control border border-danger bg-canvas px-3 py-2 text-sm text-ink focus:border-danger focus:outline-none";
const primaryBtn =
  "rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent";
const secondaryBtn =
  "rounded-control border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink";
const ghostBtn =
  "rounded-control px-4 py-2 text-sm text-ink-muted hover:text-ink";
const dangerBtn =
  "rounded-control border border-line bg-danger/15 px-4 py-2 text-sm font-medium text-danger";

const VENUES = [
  { value: "bybit", label: "Bybit" },
  { value: "hyperliquid", label: "Hyperliquid" },
];
const CONTRACTS = [
  { value: "BTCUSDT", label: "BTCUSDT", icon: "BTC" },
  { value: "ETHUSDT", label: "ETHUSDT", icon: "ETH" },
  { value: "SOLUSDT", label: "SOLUSDT", icon: "SOL" },
  { value: "DOGEUSDT", label: "DOGEUSDT", icon: "DOGE" },
  { value: "XRPUSDT", label: "XRPUSDT", icon: "XRP" },
];
const CLONE = [
  { value: "", label: "Clone existing bot" },
  { value: "dca-btc", label: "DCA · BTCUSDT" },
  { value: "perps-sol", label: "Perps · SOLUSDT" },
];

export function ThemeFormDraft() {
  const [notice, setNotice] = useState<string | null>(null);
  const [venue, setVenue] = useState("bybit");
  const [date, setDate] = useState("2026-09-01");
  const [method, setMethod] = useState("card");
  const [notify, setNotify] = useState(true);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("Sample only — this form is not submitted.");
  }

  return (
    <section className="max-w-3xl rounded-card border border-line bg-surface p-5">
      {notice ? (
        <p className="mb-4 rounded-card border border-line bg-surface-raised px-4 py-3 text-sm text-ink-muted">
          {notice}
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-ink" htmlFor="theme-form-text">
            <HintLabel
              text="Text"
              required
              hint="Hover hint on the label. Required fields use an asterisk."
              className="text-sm text-ink"
            />
            <input
              id="theme-form-text"
              name="text"
              defaultValue="Sample name"
              autoComplete="off"
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-ink" htmlFor="theme-form-email">
            Email
            <input
              id="theme-form-email"
              name="email"
              type="email"
              defaultValue="member@example.com"
              autoComplete="off"
              className={fieldClass}
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
              defaultValue="password"
              autoComplete="off"
              className={fieldClass}
            />
            <span className="mt-1 block text-xs text-ink-muted">
              Helper under the field.
            </span>
          </label>
          <label className="block text-sm text-ink" htmlFor="theme-form-search">
            Search
            <input
              id="theme-form-search"
              name="search"
              type="search"
              placeholder="Find a pair or account"
              autoComplete="off"
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-ink" htmlFor="theme-form-number">
            Number
            <input
              id="theme-form-number"
              name="number"
              type="number"
              min={0}
              step="0.01"
              defaultValue="25"
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-ink" htmlFor="theme-form-grouped">
            Grouped number
            <GroupedNumberInput
              id="theme-form-grouped"
              name="grouped"
              defaultValue="12500.5"
              allowDecimal
              className={fieldClass}
            />
          </label>
          <DatePicker
            name="date"
            label="Date"
            value={date}
            onChange={setDate}
          />
          <label className="block text-sm text-ink">
            Field dropdown
            <AppSelect
              className="mt-1"
              value={venue}
              onChange={(event) => setVenue(event.target.value)}
              options={VENUES}
            />
          </label>
          <label className="block text-sm text-ink">
            Contract
            <AppSelect
              className="mt-1"
              searchable
              defaultValue="BTCUSDT"
              options={CONTRACTS}
            />
          </label>
          <label className="block text-sm text-ink sm:col-span-2">
            Multi-select
            <AppMultiSelect
              className="mt-1"
              defaultValue={["BTCUSDT", "ETHUSDT"]}
              options={CONTRACTS}
              placeholder="Contracts"
            />
          </label>
          <label className="block text-sm text-ink">
            Action dropdown
            <AppSelect
              variant="action"
              className="mt-1"
              defaultValue=""
              options={CLONE}
            />
          </label>
          <label className="block text-sm text-ink" htmlFor="theme-form-disabled">
            Disabled
            <input
              id="theme-form-disabled"
              disabled
              defaultValue="Cannot edit"
              className={`${fieldClass} disabled:opacity-40`}
            />
          </label>
          <label className="block text-sm text-ink" htmlFor="theme-form-invalid">
            Invalid
            <input
              id="theme-form-invalid"
              defaultValue=""
              aria-invalid
              className={invalidClass}
            />
            <span className="mt-1 block text-xs text-danger">
              Fill required fields before saving.
            </span>
          </label>
        </div>

        <label className="block text-sm text-ink" htmlFor="theme-form-notes">
          Textarea
          <textarea
            id="theme-form-notes"
            name="notes"
            rows={4}
            defaultValue="Longer copy sits in a textarea."
            className={fieldClass}
          />
        </label>

        <div>
          <p className="text-sm text-ink">File</p>
          <LogoFileField
            name="logo"
            hint="PNG, JPEG, or WebP."
            emptyTone="canvas"
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm text-ink">Radio</legend>
          <label className="flex items-start gap-2 text-sm text-ink">
            <AppRadio
              name="method"
              value="card"
              checked={method === "card"}
              onChange={() => setMethod("card")}
            />
            <span>
              Card
              <span className="mt-1 block text-xs text-ink-faint">
                Automatic payments.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <AppRadio
              name="method"
              value="wallet"
              checked={method === "wallet"}
              onChange={() => setMethod("wallet")}
            />
            <span>
              Wallet
              <span className="mt-1 block text-xs text-ink-faint">
                Manual top-up. Deductions from Account Balance.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="space-y-3">
          <p className="text-sm text-ink">Checkbox</p>
          <label className="flex items-start gap-2 text-sm text-ink">
            <AppCheck
              checked={notify}
              onChange={(event) => setNotify(event.target.checked)}
            />
            Email me when this changes
          </label>
        </div>

        <div className="space-y-3">
          <p className="rounded-card border border-line bg-surface-raised px-4 py-3 text-sm text-ink-muted">
            Neutral callout
          </p>
          <p className="rounded-card border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-ink">
            Accent callout
          </p>
          <p className="rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            Success callout
          </p>
          <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            Warning callout
          </p>
          <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            Danger callout
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={primaryBtn}>
            Primary
          </button>
          <button type="button" className={secondaryBtn}>
            Secondary
          </button>
          <button type="button" className={ghostBtn}>
            Ghost
          </button>
          <button type="button" className={dangerBtn}>
            Danger
          </button>
        </div>
      </form>
    </section>
  );
}
