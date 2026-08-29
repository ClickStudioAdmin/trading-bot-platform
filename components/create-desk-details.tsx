import { DeskTypeMark } from "@/components/desk-mark";
import { formatDeskType, type DeskType } from "@/lib/accounts/model";

const DETAILS: Record<
  DeskType,
  { summary: string; points: readonly string[] }
> = {
  cash_and_carry: {
    summary:
      "Harvest the basis between USDT spot and a dated future on the same venue.",
    points: [
      "Long spot and short the matching dated future.",
      "The engine opens and closes the pair as one book.",
      "Paper uses public marks and fills on the in-app ledger.",
    ],
  },
  perps: {
    summary: "Manual ticket only. Buy, sell, and close one perpetual.",
    points: [
      "No automations or webhooks on this desk.",
      "Take profit, stop, and trailing stay on the position.",
      "Close All still flattens the book.",
    ],
  },
  perps_bots: {
    summary: "Price-cross automations own the orders. No buy / sell ticket.",
    points: [
      "Bots Buy, Sell, or Close when last, mark, or index crosses a price.",
      "A Signal webhook is a When trigger on the bot. Bind it on Automations.",
      "TradingView strategy alerts that place orders stay on a TradingView Strategy desk.",
      "Close All still flattens the book.",
    ],
  },
  signal_follower: {
    summary:
      "TradingView alerts place the orders. This desk only protects the book.",
    points: [
      "No buy / sell ticket — the webhook is the order.",
      "Order webhooks only. Signal webhooks are not used here.",
      "Caps, reduce-only, Close All, and row TP/SL still apply.",
    ],
  },
  dca: {
    summary:
      "The app owns entries and exits. Signals only arm a playbook.",
    points: [
      "One stacked playbook per contract on this desk.",
      "Clip size, averaging, and exits are set on the bot.",
      "Paper fills on the in-app ledger. Live places venue orders.",
    ],
  },
};

export function CreateDeskDetails({ deskType }: { deskType: DeskType }) {
  const copy = DETAILS[deskType];

  return (
    <aside className="rounded-card border border-line bg-surface p-5 lg:sticky lg:top-6">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">
        About this type
      </p>
      <h2 className="mt-2 flex items-center gap-2 text-lg font-semibold tracking-tight">
        <DeskTypeMark deskType={deskType} />
        {formatDeskType(deskType)}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">{copy.summary}</p>
      <ul className="mt-4 list-disc space-y-2 pl-4 text-sm text-ink">
        {copy.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <div className="mt-5">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">
          Explainer
        </p>
        <div
          className="mt-2 flex aspect-video flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-canvas text-ink-faint"
          role="img"
          aria-label={`${formatDeskType(deskType)} explainer video placeholder`}
        >
          <PlayMark />
          <p className="text-sm">Video placeholder</p>
          <p className="text-xs">Coming soon</p>
        </div>
      </div>
    </aside>
  );
}

function PlayMark() {
  return (
    <span className="inline-flex size-10 items-center justify-center rounded-full border border-line text-ink-muted">
      <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
        <path d="M6 4.2v7.6L12.2 8 6 4.2Z" />
      </svg>
    </span>
  );
}
