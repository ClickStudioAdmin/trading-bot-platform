import type { ReactNode } from "react";
import { AppCheck, AppRadio } from "@/components/app-check";
import { HintLabel } from "@/components/bot-form-chrome";
import { CopyTextButton } from "@/components/copy-text-button";
import { IconCheck } from "@/components/icons";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";

/** Type roles. Card samples use this scale. Live pages are called out below. */
export const themeCardTitleClass =
  "text-lg font-semibold tracking-tight text-ink";
export const themeCardIntroClass = "mt-2 text-sm text-ink-muted";
export const themeGroupTitleClass = "text-sm font-semibold text-ink";
export const themeBodyClass = "text-sm text-ink";
export const themeFormLabelClass = "block text-sm text-ink";
export const themeChoiceLabelClass = "text-sm text-ink";
export const themeHelperClass = "mt-1 block text-hint text-ink-muted";
export const themeHintClass = "text-hint text-ink-faint";
export const themeFactLabelClass =
  "text-xs uppercase tracking-[0.12em] text-ink-muted";
export const themeFactValueClass = "mt-1 text-sm text-ink";
export const themeKpiValueClass =
  "text-2xl font-semibold tabular-nums tracking-tight text-ink";
export const themeAddressWellClass =
  "min-w-0 flex-1 break-all rounded-control border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink";

const fieldClass = BILLING_FIELD_CLASS;
const primaryBtn =
  "rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent";
const secondaryBtn =
  "rounded-control border border-line px-4 py-2 text-sm text-ink hover:bg-surface-raised";
const SAMPLE_ADDRESS = "0x9d2ab4927716d8f5170c4e5488f75411bdbbea76";

const SCALE: {
  role: string;
  sample: string;
  cls: string;
  px: string;
  use: string;
}[] = [
  {
    role: "Page title",
    sample: "Billing & Account",
    cls: "text-2xl font-semibold tracking-tight text-ink",
    px: "24",
    use: "PageHeading. Live and Theme → Type are 24.",
  },
  {
    role: "Card title",
    sample: "Subscription Details",
    cls: themeCardTitleClass,
    px: "18",
    use: "Every card heading. Reference: billing Subscription Details.",
  },
  {
    role: "Group title",
    sample: "Entry Conditions",
    cls: themeGroupTitleClass,
    px: "14",
    use: "Inner groups, Status & Save, notification groups.",
  },
  {
    role: "Body",
    sample: "Primary copy on a surface.",
    cls: themeBodyClass,
    px: "14",
    use: "Sentences, table cells, radio titles.",
  },
  {
    role: "Card intro",
    sample: "Name and login email for this account.",
    cls: "text-sm text-ink-muted",
    px: "14",
    use: "Supporting sentence under a card title.",
  },
  {
    role: "Form label",
    sample: "Name",
    cls: themeFormLabelClass,
    px: "14",
    use: "Every field label. 14px ink — white in dark mode, dark in light.",
  },
  {
    role: "Fact label",
    sample: "CURRENT PLAN",
    cls: themeFactLabelClass,
    px: "12",
    use: "Subscription Details. Top up keeps the label beside the value.",
  },
  {
    role: "Fact value",
    sample: "Plusus",
    cls: "text-sm text-ink",
    px: "14",
    use: "Value under a fact label.",
  },
  {
    role: "Helper",
    sample: "Email is the login. An admin can change it from Members.",
    cls: "text-hint text-ink-muted",
    px: "13",
    use: "Copy under a field, checkbox, or address well.",
  },
  {
    role: "Hint",
    sample: "Hover or inactive only.",
    cls: themeHintClass,
    px: "13",
    use: "Hover tooltips and inactive chrome — not field helpers.",
  },
  {
    role: "KPI value",
    sample: "$237",
    cls: themeKpiValueClass,
    px: "24",
    use: "Balance and stat tiles.",
  },
];

export function ThemeCardsDraft() {
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Type scale</h2>
        <p className="text-sm text-ink-muted">
          Card titles are 18px. Field labels are 14px ink — white in dark
          mode. Card intros are 14px muted. Fact rows are 12px uppercase
          labels and 14px values, with the label beside the value on Top up.
          Helpers under fields are 13px muted.
        </p>
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Sample</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Use</th>
              </tr>
            </thead>
            <tbody>
              {SCALE.map((row) => (
                <tr key={row.role} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-ink">{row.role}</td>
                  <td className="px-4 py-3">
                    <span className={row.cls}>{row.sample}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-muted">
                    {row.px}px
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{row.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">
          Profile — live vs scale
        </h2>
        <p className="text-sm text-ink-muted">
          Live Account Holder matches the scale: 18px title, 14px muted intro,
          14px white field labels, 13px muted helper.
        </p>
        <div className="grid gap-5 lg:grid-cols-2">
          <SampleFrame label="Live — Account Holder">
            <Card>
              <p className="text-lg font-semibold tracking-tight">
                Account Holder
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Name and login email for this account.
              </p>
              <label className="mt-4 block text-sm text-ink">
                Name
                <input
                  defaultValue="Click Studio"
                  readOnly
                  className={fieldClass}
                />
              </label>
              <label className="mt-4 block text-sm text-ink">
                Email
                <input
                  defaultValue="click.studioadmin@gmail.com"
                  readOnly
                  className={`${fieldClass} text-ink-muted`}
                />
                <span className="mt-1 block text-hint text-ink-muted">
                  Email is the login. An admin can change it from Members.
                </span>
              </label>
              <button type="button" className={`${primaryBtn} mt-4`}>
                Save profile
              </button>
            </Card>
          </SampleFrame>
          <SampleFrame label="Scale — Account Holder">
            <FormCard />
          </SampleFrame>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Card types</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Every surface that uses a card, set in the proposed type roles.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <SampleFrame
            label="Fact card"
            note="Reference. Matches live Subscription Details."
          >
            <FactCard />
          </SampleFrame>
          <SampleFrame
            label="KPI card"
            note="Account Balance. Title 18, fact label, KPI 24."
          >
            <KpiCard />
          </SampleFrame>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <SampleFrame
            label="Choice card"
            note="Payment method. Radio title is body. Notes are helpers."
          >
            <ChoiceCard />
          </SampleFrame>
          <SampleFrame
            label="Deposit card"
            note="Top-up. Label beside the value. Fact label 12 uppercase, value 14."
          >
            <DepositCard />
          </SampleFrame>
        </div>

        <SampleFrame
          label="Stat tiles"
          note="No card title — the uppercase label is the title."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Total balance"
              value="$284,392.18"
              change="+2.4%"
              tone="success"
            />
            <StatTile
              label="24h P&L"
              value="−$1,204.00"
              change="−0.4%"
              tone="danger"
            />
            <StatTile
              label="Active positions"
              value="3"
              change="Sample"
              tone="muted"
            />
            <StatTile
              label="Net APR"
              value="11.3%"
              change="Best pair"
              tone="accent"
            />
          </div>
        </SampleFrame>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SampleFrame
              label="Bot step card"
              note="18px step title, 14px group, 14px muted labels."
            >
              <BotStepCard />
            </SampleFrame>
          </div>
          <SampleFrame
            label="Sidebar card"
            note="Status & Save. Group title, not a card title."
          >
            <SidebarCard />
          </SampleFrame>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SampleFrame
              label="Chart card"
              note="Same 18px title as other cards."
            >
              <ChartCard />
            </SampleFrame>
          </div>
          <SampleFrame label="Allocation card">
            <AllocationCard />
          </SampleFrame>
        </div>

        <SampleFrame
          label="Table card"
          note="Table chrome already lives on Theme → Table. Title is 18px."
        >
          <TableCard />
        </SampleFrame>

        <div className="grid gap-5 lg:grid-cols-2">
          <SampleFrame
            label="Attention / list card"
            note="Admin and account home."
          >
            <AttentionCard />
          </SampleFrame>
          <SampleFrame label="Empty state card">
            <EmptyCard />
          </SampleFrame>
        </div>

        <SampleFrame
          label="Callouts"
          note="Body 14. Not card titles — they are notices."
        >
          <div className="space-y-3">
            <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
              Neutral — supporting note on a surface.
            </p>
            <p className="rounded-card border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-ink">
              Accent — active or informational highlight.
            </p>
            <p className="rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
              Success — confirmed or positive.
            </p>
            <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              Warning — checkout or method change.
            </p>
            <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              Danger — risk, reject, or kill-switch.
            </p>
          </div>
        </SampleFrame>

        <div className="grid gap-5 lg:grid-cols-2">
          <SampleFrame
            label="Plan compare header"
            note="Special: plan-header fill. Name is overline, price is 18."
          >
            <PlanHeaderCard />
          </SampleFrame>
          <SampleFrame
            label="Catalogue card"
            note="Copy desk tile. Stats stay 18 tabular, labels 12 muted fact."
          >
            <CatalogueCard />
          </SampleFrame>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <SampleFrame
            label="Auth / narrow form"
            note="Sign in, sign up, forgot password."
          >
            <AuthCard />
          </SampleFrame>
          <SampleFrame
            label="Modal card"
            note="In-app confirm. Title 18, body 14, helper 12."
          >
            <ModalCard />
          </SampleFrame>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <SampleFrame
            label="URL / share card"
            note="Affiliate default URL. Well is mono 12, copy on the right."
          >
            <UrlCard />
          </SampleFrame>
          <SampleFrame
            label="Invite / notice row card"
            note="Nested rows stay body + helper, not a second title size."
          >
            <InviteCard />
          </SampleFrame>
        </div>
      </section>
    </div>
  );
}

function SampleFrame({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </p>
      {note ? <p className="mt-1 text-xs text-ink-muted">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-card border border-line bg-surface p-5 ${className}`.trim()}
    >
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={themeFactLabelClass}>{label}</p>
      <p className={themeFactValueClass}>{value}</p>
    </div>
  );
}

function FactCard() {
  return (
    <Card>
      <h3 className={themeCardTitleClass}>Subscription Details</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="space-y-4">
          <Fact label="Current plan" value="Plusus" />
          <Fact label="Monthly payment" value="$19 / monthly" />
          <Fact label="Payment method" value="Crypto (account balance)" />
        </div>
        <div className="space-y-4">
          <Fact label="Billing cycle" value="17/08/2026 – 16/09/2026" />
          <Fact label="Next payment due" value="16/09/2026 · Ended" />
          <div className="pt-1">
            <button type="button" className={primaryBtn}>
              Upgrade
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function KpiCard() {
  return (
    <Card>
      <h3 className={themeCardTitleClass}>Account Balance</h3>
      <div className="mt-3">
        <p className={themeFactLabelClass}>Current balance</p>
        <p className={`mt-1 ${themeKpiValueClass}`}>$237</p>
      </div>
      <p className="mt-4">
        <span className="text-sm text-accent">Manage Account Balance</span>
      </p>
    </Card>
  );
}

function FormCard() {
  return (
    <Card>
      <h3 className={themeCardTitleClass}>Account Holder</h3>
      <p className={themeCardIntroClass}>
        Name and login email for this account.
      </p>
      <label className={`${themeFormLabelClass} mt-4`} htmlFor="theme-card-name">
        Name
        <input
          id="theme-card-name"
          defaultValue="Click Studio"
          readOnly
          className={fieldClass}
        />
      </label>
      <label className={`${themeFormLabelClass} mt-4`} htmlFor="theme-card-email">
        Email
        <input
          id="theme-card-email"
          defaultValue="click.studioadmin@gmail.com"
          readOnly
          className={`${fieldClass} text-ink-muted`}
        />
        <span className={themeHelperClass}>
          Email is the login. An admin can change it from Members.
        </span>
      </label>
      <button type="button" className={`${primaryBtn} mt-4`}>
        Save profile
      </button>
    </Card>
  );
}

function ChoiceCard() {
  return (
    <Card>
      <h3 className={themeCardTitleClass}>Current payment method</h3>
      <fieldset className="mt-4 space-y-3">
        <legend className="sr-only">Select payment method</legend>
        <label className={`flex items-start gap-2 ${themeChoiceLabelClass}`}>
          <AppRadio name="theme-card-method" value="stripe" />
          <span>
            Credit Card (Stripe)
            <span className={themeHelperClass}>
              Automatic payments handled by Stripe.
            </span>
          </span>
        </label>
        <label className={`flex items-start gap-2 ${themeChoiceLabelClass}`}>
          <AppRadio name="theme-card-method" value="wallet" defaultChecked />
          <span>
            Crypto
            <span className={themeHelperClass}>
              Manual payments required to top up your account. Monthly
              payments are deducted from your account balance when due.
            </span>
          </span>
        </label>
        <label
          className={`ml-6 flex items-start gap-2 ${themeChoiceLabelClass}`}
        >
          <AppCheck name="theme-card-deduct" value="1" defaultChecked />
          <span>
            Deduct payment from Affiliate earnings if required
            <span className={themeHelperClass}>
              If your Account balance doesn&apos;t have sufficient funds to
              pay your subscription, the shortfall is transferred from your
              Affiliate earnings to your Account balance.
            </span>
          </span>
        </label>
      </fieldset>
    </Card>
  );
}

function DepositCard() {
  return (
    <Card>
      <h3 className={themeCardTitleClass}>Top up Account Balance</h3>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 text-sm">
        <dt className={themeFactLabelClass}>Current Balance</dt>
        <dd className="tabular-nums text-ink">$237</dd>
        <dt className={themeFactLabelClass}>Network</dt>
        <dd className="text-ink">Arbitrum Sepolia</dd>
        <dt className={themeFactLabelClass}>Token</dt>
        <dd className="text-ink">USDT</dd>
        <dt className={themeFactLabelClass}>Address</dt>
        <dd className="min-w-0">
          <div className="flex items-center gap-2">
            <p className={themeAddressWellClass}>{SAMPLE_ADDRESS}</p>
            <CopyTextButton text={SAMPLE_ADDRESS} label="Copy address" />
          </div>
        </dd>
      </dl>
      <p className={`${themeHelperClass} mt-3`}>
        Keep enough balance for your next monthly subscription ($19). Remaining
        balance can cover later payments. Withdraw any time. Transfer one of
        the listed stablecoins.
      </p>
      <button type="button" className={`${primaryBtn} mt-4`}>
        Check for deposit
      </button>
    </Card>
  );
}

function StatTile({
  label,
  value,
  change,
  tone,
}: {
  label: string;
  value: string;
  change: string;
  tone: "success" | "danger" | "accent" | "muted";
}) {
  const changeClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "accent"
          ? "text-accent"
          : "text-ink-faint";
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <p className={themeFactLabelClass}>{label}</p>
      <p className={`mt-3 ${themeKpiValueClass}`}>{value}</p>
      <p className={`mt-2 text-xs ${changeClass}`}>{change}</p>
    </div>
  );
}

function BotStepCard() {
  return (
    <Card className="p-0">
      <h3 className={`${themeCardTitleClass} px-5 py-5`}>General</h3>
      <div className="space-y-4 border-t border-line px-5 py-5">
        <p className={themeGroupTitleClass}>Identity</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={themeFormLabelClass} htmlFor="theme-card-bot-name">
            <HintLabel
              text="Name"
              required
              hint="Shown on Automations. Hover hints stay on the label."
              className="text-sm text-ink"
            />
            <input
              id="theme-card-bot-name"
              defaultValue="DCA · BTCUSDT"
              readOnly
              className={fieldClass}
            />
          </label>
          <label className={themeFormLabelClass} htmlFor="theme-card-bot-pair">
            Contract
            <input
              id="theme-card-bot-pair"
              defaultValue="BTCUSDT"
              readOnly
              className={fieldClass}
            />
          </label>
        </div>
      </div>
    </Card>
  );
}

function SidebarCard() {
  return (
    <Card>
      <h3 className={themeGroupTitleClass}>Status & Save</h3>
      <label className={`${themeFormLabelClass} mt-4`}>
        Status
        <input defaultValue="Disabled" readOnly className={fieldClass} />
        <span className={themeHelperClass}>
          Save applies the selected mode.
        </span>
      </label>
      <button type="button" className={`${primaryBtn} mt-4 w-full`}>
        Save
      </button>
    </Card>
  );
}

function ChartCard() {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h3 className={themeCardTitleClass}>Area chart</h3>
          <p className={themeCardIntroClass}>Accent line, faint fill</p>
        </div>
        <div className="flex gap-1 text-xs">
          <span className="rounded-control bg-surface-raised px-2 py-1 text-ink">
            7D
          </span>
          <span className="rounded-control px-2 py-1 text-ink-faint">30D</span>
        </div>
      </div>
      <svg
        viewBox="0 0 400 120"
        className="mt-6 h-28 w-full"
        role="img"
        aria-label="Sample area chart"
      >
        <defs>
          <linearGradient id="theme-card-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 80 L50 70 L100 78 L150 50 L200 58 L250 36 L300 42 L350 28 L400 32 L400 120 L0 120 Z"
          fill="url(#theme-card-area)"
        />
        <path
          d="M0 80 L50 70 L100 78 L150 50 L200 58 L250 36 L300 42 L350 28 L400 32"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
        />
      </svg>
    </Card>
  );
}

function AllocationCard() {
  return (
    <Card>
      <h3 className={themeCardTitleClass}>Allocation</h3>
      <p className={themeCardIntroClass}>Accent / success / warning</p>
      <div className="mt-6 flex items-center gap-5">
        <svg viewBox="0 0 40 40" className="h-24 w-24" aria-hidden>
          <circle
            cx="20"
            cy="20"
            r="14"
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="6"
          />
          <circle
            cx="20"
            cy="20"
            r="14"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="6"
            strokeDasharray="50 88"
          />
          <circle
            cx="20"
            cy="20"
            r="14"
            fill="none"
            stroke="var(--color-success)"
            strokeWidth="6"
            strokeDasharray="22 88"
            strokeDashoffset="-50"
          />
          <circle
            cx="20"
            cy="20"
            r="14"
            fill="none"
            stroke="var(--color-warning)"
            strokeWidth="6"
            strokeDasharray="16 88"
            strokeDashoffset="-72"
          />
        </svg>
        <ul className="space-y-1 text-xs text-ink-muted">
          <li>
            <span className="text-accent">●</span> Accent 56%
          </li>
          <li>
            <span className="text-success">●</span> Success 25%
          </li>
          <li>
            <span className="text-warning">●</span> Warning 19%
          </li>
        </ul>
      </div>
    </Card>
  );
}

function TableCard() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <h3 className={themeCardTitleClass}>Sample table</h3>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
          <tr>
            <th className="px-4 py-3 font-medium">Pair</th>
            <th className="px-4 py-3 font-medium">Net APR</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-line">
            <td className="px-4 py-3 text-ink">BTC / 25SEP26</td>
            <td className="px-4 py-3 text-success">11.3%</td>
            <td className="px-4 py-3 text-accent">Candidate</td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-ink">DOGE / 25SEP26</td>
            <td className="px-4 py-3 text-danger">−0.1%</td>
            <td className="px-4 py-3 text-ink-muted">Ignore</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function AttentionCard() {
  return (
    <Card>
      <h3 className={themeCardTitleClass}>Attention</h3>
      <ul className="mt-3 space-y-2">
        <li className="text-sm text-ink">Engine worker missed a heartbeat.</li>
        <li className="text-sm text-ink-muted">
          One desk has a pending flatten.
        </li>
      </ul>
    </Card>
  );
}

function EmptyCard() {
  return (
    <Card>
      <h3 className={themeCardTitleClass}>Invoices</h3>
      <p className={themeCardIntroClass}>No invoices yet for this account.</p>
    </Card>
  );
}

function PlanHeaderCard() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="bg-plan-header px-3 pb-4 pt-5 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink">
          Plusus
        </p>
        <p className="mt-2 text-lg font-semibold tabular-nums text-ink">
          $19 / mo
        </p>
      </div>
      <div className="space-y-2 px-4 py-5 text-center">
        <p className="flex items-center justify-center gap-1.5 text-sm text-ink">
          <IconCheck size={14} /> 3 live desks
        </p>
        <p className="text-sm text-ink-muted">Affiliate payouts</p>
        <button type="button" className={`${primaryBtn} mt-3 w-full`}>
          Current plan
        </button>
      </div>
    </div>
  );
}

function CatalogueCard() {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={themeCardTitleClass}>Alpha · SOL Perps</h3>
          <p className="mt-1 text-xs text-ink-muted">Perpetuals · Bybit</p>
        </div>
        <span className="rounded-control border border-line px-2 py-0.5 text-xs text-ink-faint">
          Public
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
        <div>
          <dt className={themeFactLabelClass}>Realized [30d]</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-success">
            +$4,210
          </dd>
        </div>
        <div>
          <dt className={themeFactLabelClass}>Win rate [30d]</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">
            62%
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function AuthCard() {
  return (
    <Card>
      <h3 className={themeCardTitleClass}>Sign in</h3>
      <p className={themeCardIntroClass}>Use the email for this account.</p>
      <label className={`${themeFormLabelClass} mt-4`} htmlFor="theme-card-auth">
        Email
        <input
          id="theme-card-auth"
          defaultValue="you@studio.test"
          readOnly
          className={fieldClass}
        />
      </label>
      <button type="button" className={`${primaryBtn} mt-4 w-full`}>
        Continue
      </button>
    </Card>
  );
}

function ModalCard() {
  return (
    <Card>
      <h3 className={themeCardTitleClass}>Disable this bot?</h3>
      <p className={`${themeBodyClass} mt-2`}>
        Save will close positions this bot owns and turn it off.
      </p>
      <p className={themeHelperClass}>
        This confirm is in-app. It does not use the browser dialog.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={secondaryBtn}>
          Cancel
        </button>
        <button
          type="button"
          className="rounded-control border border-line bg-danger/15 px-4 py-2 text-sm font-medium text-danger"
        >
          Disable
        </button>
      </div>
    </Card>
  );
}

function UrlCard() {
  return (
    <Card>
      <h3 className={themeCardTitleClass}>Your URLs</h3>
      <p className={themeCardIntroClass}>Default share link for this login.</p>
      <div className="mt-4 flex items-center gap-2">
        <p className={themeAddressWellClass}>
          https://app.example/join?ref=studio
        </p>
        <CopyTextButton
          text="https://app.example/join?ref=studio"
          label="Copy URL"
        />
      </div>
    </Card>
  );
}

function InviteCard() {
  return (
    <Card>
      <h3 className={themeCardTitleClass}>Copy invites</h3>
      <p className={themeCardIntroClass}>
        Private grants to follow another desk.
      </p>
      <div className="mt-4 rounded-control border border-line px-3 py-2">
        <p className={themeBodyClass}>Trading Godmode · SOL Perps</p>
        <p className={themeHelperClass}>Invited</p>
      </div>
    </Card>
  );
}
