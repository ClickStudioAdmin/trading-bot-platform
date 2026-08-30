import Link from "next/link";
import { DeskTypeMark } from "@/components/desk-mark";
import { formatDeskType, type DeskType } from "@/lib/accounts/model";

const DESKS: {
  id: string;
  deskType: DeskType;
  summary: string;
}[] = [
  {
    id: "cash-and-carry",
    deskType: "cash_and_carry",
    summary:
      "Harvest the basis between USDT spot and a dated future on the same venue.",
  },
  {
    id: "perps",
    deskType: "perps",
    summary: "Buy, sell, and close one perpetual from the desk ticket. No bots.",
  },
  {
    id: "perps-bots",
    deskType: "perps_bots",
    summary: "Price-cross automations own the orders. No buy / sell ticket.",
  },
  {
    id: "tradingview-strategy",
    deskType: "signal_follower",
    summary:
      "TradingView alerts place the orders. The desk only protects the book.",
  },
  {
    id: "dca",
    deskType: "dca",
    summary:
      "The app owns entries and exits. Signals only arm a playbook.",
  },
];

const STEPS = [
  {
    title: "Create a typed desk",
    body: "Cash and Carry, Perps, Perps bots, TradingView Strategy, or DCA. Type is set at create and never changes.",
  },
  {
    title: "Paper or Connected Exchange",
    body: "Paper uses public marks and the in-app ledger. Live binds a trade-only key from this login.",
  },
  {
    title: "The desk owns the book",
    body: "Orders, exits, and automations stay on the server. Keys never reach the browser.",
  },
];

export function MarketingHome({ appHref = null }: { appHref?: string | null }) {
  const primaryHref = appHref ?? "/sign-in";
  const primaryLabel = appHref ? "Go to App" : "Sign in";
  const appLinkProps = appHref
    ? { target: "_blank" as const, rel: "noreferrer" }
    : {};

  return (
    <main>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            Trading Bot Platform
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Your strategies. Your keys. One desk.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
            Invite-only desk for running typed books. Paper trade on live marks,
            or bind a trade-only exchange key. The app places and manages
            orders. You keep the keys.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={primaryHref}
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
              {...appLinkProps}
            >
              {primaryLabel}
            </Link>
            <Link
              href="#desks"
              className="rounded-control px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              See desk types
            </Link>
          </div>
        </div>
      </section>

      <section id="desks" className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
          Desks
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          Five types. One login.
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Each desk locks its manager. Create as many as you need. Paper and
          live stay separate.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {DESKS.map((desk) => (
            <article
              key={desk.deskType}
              id={desk.id}
              className="rounded-card border border-line bg-surface p-5"
            >
              <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <DeskTypeMark deskType={desk.deskType} />
                {formatDeskType(desk.deskType)}
              </h3>
              <p className="mt-2 text-sm text-ink-muted">{desk.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            How it works
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            Start on paper. Bind a key when you are ready.
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-card border border-line bg-canvas p-5"
              >
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-ink-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="keys" className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-card border border-line bg-surface p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            Keys
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            Trade-only keys. No custody.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">
            Exchange connections live on the login, encrypted at rest. A live
            desk binds one key. Withdrawal permission is not used. Decrypted
            secrets never go to the browser.
          </p>
          <Link
            href={primaryHref}
            className="mt-6 inline-flex rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            {...appLinkProps}
          >
            {appHref ? "Go to App" : "Sign in to the desk"}
          </Link>
        </div>
      </section>
    </main>
  );
}
