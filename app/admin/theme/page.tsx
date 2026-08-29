import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { ButtonBusyIcon } from "@/components/pending-submit-button";

export const metadata: Metadata = {
  title: "Theme",
  description: "Visual reference for the TBP business portal theme.",
};

const colours = [
  { name: "canvas", hex: "#0B0E14", use: "Page background" },
  { name: "surface", hex: "#161B22", use: "Cards, sidebar, header" },
  { name: "surface-raised", hex: "#1C222C", use: "Hover and active chrome" },
  { name: "line", hex: "#2A313C", use: "Default borders" },
  { name: "line-strong", hex: "#3A4352", use: "Focus / strong dividers" },
  { name: "ink", hex: "#F4F6F8", use: "Primary text" },
  { name: "ink-muted", hex: "#9AA3B2", use: "Labels" },
  { name: "ink-faint", hex: "#6B7382", use: "Inactive / hints" },
  { name: "accent", hex: "#A78BFA", use: "Links, charts, active" },
  { name: "accent-strong", hex: "#8B6CF6", use: "Primary fill" },
  { name: "success", hex: "#34D399", use: "Positive" },
  { name: "danger", hex: "#F07167", use: "Negative" },
  { name: "warning", hex: "#F5B942", use: "Caution" },
] as const;

const swatchClass: Record<(typeof colours)[number]["name"], string> = {
  canvas: "bg-canvas",
  surface: "bg-surface",
  "surface-raised": "bg-surface-raised",
  line: "bg-line",
  "line-strong": "bg-line-strong",
  ink: "bg-ink",
  "ink-muted": "bg-ink-muted",
  "ink-faint": "bg-ink-faint",
  accent: "bg-accent",
  "accent-strong": "bg-accent-strong",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
};

export default function ThemePage() {
  return (
    <div className="space-y-12">
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="flex gap-8 px-5 py-2.5 text-xs whitespace-nowrap text-ink-muted">
          <span>
            ETH <span className="text-success">+1.4%</span>
          </span>
          <span>
            SOL <span className="text-danger">−0.8%</span>
          </span>
          <span>
            BTC <span className="text-success">+0.3%</span>
          </span>
          <span>
            XRP <span className="text-ink-faint">0.0%</span>
          </span>
          <span className="text-ink-faint">Sample ticker — not live data</span>
        </div>
      </div>

      <div className="space-y-12">
        <PageHeading overline="Reference" title="Portal theme" />
        <section>
          <h2 className="text-xl font-semibold tracking-tight">Colour</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Tailwind tokens from <code className="text-accent">app/globals.css</code>.
            Use these names. Do not invent hex in components.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {colours.map((colour) => (
              <div
                key={colour.name}
                className="flex gap-3 rounded-card border border-line bg-surface p-3"
              >
                <div
                  className={`h-14 w-14 shrink-0 rounded-control border border-line ${swatchClass[colour.name]}`}
                />
                <div className="min-w-0">
                  <p className="font-medium">{colour.name}</p>
                  <p className="font-mono text-xs text-ink-muted">{colour.hex}</p>
                  <p className="mt-1 text-xs text-ink-faint">{colour.use}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight">Type</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Geist. High-contrast values, muted labels.
          </p>
          <div className="mt-5 space-y-4 rounded-card border border-line bg-surface p-6">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
              Overline
            </p>
            <p className="text-3xl font-semibold tracking-tight">Page title 30</p>
            <p className="text-xl font-semibold">Section 20</p>
            <p className="text-sm text-ink">
              Body 14 — primary copy on canvas or surface.
            </p>
            <p className="text-sm text-ink-muted">
              Secondary 14 — supporting description.
            </p>
            <p className="text-xs text-ink-faint">Hint 12 — inactive or helper.</p>
            <p className="text-3xl font-semibold tracking-tight">$284,392.18</p>
            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
              KPI value
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight">Stat cards</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total balance"
              value="$284,392.18"
              change="+2.4%"
              tone="success"
            />
            <StatCard
              label="24h P&L"
              value="−$1,204.00"
              change="−0.4%"
              tone="danger"
            />
            <StatCard
              label="Active positions"
              value="3"
              change="Sample"
              tone="muted"
            />
            <StatCard
              label="Net APR"
              value="11.3%"
              change="Best pair"
              tone="accent"
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-card border border-line bg-surface p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Area chart</h3>
                <p className="text-xs text-ink-muted">Accent line, faint fill</p>
              </div>
              <div className="flex gap-1 text-xs">
                <span className="rounded-control bg-surface-raised px-2 py-1 text-ink">
                  7D
                </span>
                <span className="rounded-control px-2 py-1 text-ink-faint">
                  30D
                </span>
              </div>
            </div>
            <svg
              viewBox="0 0 400 120"
              className="mt-6 h-28 w-full"
              role="img"
              aria-label="Sample area chart using accent"
            >
              <defs>
                <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-accent)"
                    stopOpacity="0.35"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-accent)"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              <path
                d="M0 80 L50 70 L100 78 L150 50 L200 58 L250 36 L300 42 L350 28 L400 32 L400 120 L0 120 Z"
                fill="url(#area)"
              />
              <path
                d="M0 80 L50 70 L100 78 L150 50 L200 58 L250 36 L300 42 L350 28 L400 32"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="2"
              />
            </svg>
          </div>
          <div className="rounded-card border border-line bg-surface p-6">
            <h3 className="font-semibold">Allocation</h3>
            <p className="text-xs text-ink-muted">Accent / success / warning</p>
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
                  strokeDashoffset="0"
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
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight">Controls</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Press scales the control. Submits show a spinner and stay disabled
            until the request finishes.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              Primary
            </button>
            <button
              type="button"
              className="rounded-control border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-surface-raised"
            >
              Secondary
            </button>
            <button
              type="button"
              className="rounded-control px-4 py-2 text-sm text-ink-muted hover:text-ink"
            >
              Ghost
            </button>
            <button
              type="button"
              className="rounded-control border border-line bg-danger/15 px-4 py-2 text-sm font-medium text-danger"
            >
              Danger
            </button>
            <button
              type="button"
              disabled
              aria-busy
              className="inline-flex items-center gap-1.5 rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              <ButtonBusyIcon />
              Saving…
            </button>
            <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs text-success">
              Success
            </span>
            <span className="rounded-full bg-danger/15 px-2.5 py-0.5 text-xs text-danger">
              12
            </span>
            <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs text-warning">
              Warning
            </span>
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs text-accent">
              Accent
            </span>
          </div>
          <div className="mt-4 max-w-md">
            <label className="text-xs text-ink-muted" htmlFor="theme-search">
              Search
            </label>
            <input
              id="theme-search"
              placeholder="Find a pair, order, or account"
              className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-card border border-line bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-ink-faint">
              Nav
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              <li className="rounded-control bg-surface-raised px-3 py-2 text-ink">
                Dashboard
              </li>
              <li className="rounded-control px-3 py-2 text-ink-muted">
                Opportunities
              </li>
              <li className="flex items-center justify-between rounded-control px-3 py-2 text-ink-faint">
                Blotter
                <span className="rounded-full bg-danger px-1.5 text-[10px] text-ink">
                  3
                </span>
              </li>
            </ul>
          </div>
          <div className="lg:col-span-2 overflow-hidden rounded-card border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
                <tr>
                  <th className="px-4 py-3 font-medium">Pair</th>
                  <th className="px-4 py-3 font-medium">Net APR</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-ink">
                <tr className="border-b border-line">
                  <td className="px-4 py-3">BTC / 25SEP26</td>
                  <td className="px-4 py-3 text-success">11.3%</td>
                  <td className="px-4 py-3 text-accent">Candidate</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">DOGE / 25SEP26</td>
                  <td className="px-4 py-3 text-danger">−0.1%</td>
                  <td className="px-4 py-3 text-ink-faint">Ignore</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Callouts</h2>
          <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
            Neutral — supporting note on a surface.
          </p>
          <p className="rounded-card border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-ink">
            Accent — active or informational highlight.
          </p>
          <p className="rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            Success — confirmed or positive.
          </p>
          <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            Danger — risk, reject, or kill-switch.
          </p>
        </section>

        <p className="text-xs text-ink-faint">
          Sample figures are for theme review only. Source: docs/ui-theme.md
        </p>
      </div>
    </div>
  );
}

function StatCard({
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
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className={`mt-2 text-xs ${changeClass}`}>{change}</p>
    </div>
  );
}
