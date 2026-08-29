import type { DeskType, TradingAccount } from "@/lib/accounts/model";
import {
  formatAccountMode,
  formatDeskType,
  formatDeskVenueCaption,
} from "@/lib/accounts/model";

export function DeskMark({ desk }: { desk: TradingAccount }) {
  const label =
    desk.mode === "paper"
      ? formatAccountMode(desk.mode)
      : formatDeskVenueCaption(desk);
  return (
    <span
      className="inline-flex size-5 shrink-0 items-center justify-center text-ink-muted"
      title={label}
      aria-label={label}
    >
      {desk.mode === "paper" ? (
        <PaperIcon />
      ) : (
        <VenueIcon venue={desk.venue} />
      )}
    </span>
  );
}

export function DeskTypeMark({ deskType }: { deskType: DeskType }) {
  return (
    <span
      className="inline-flex size-4 shrink-0 items-center justify-center text-ink-faint"
      title={formatDeskType(deskType)}
      aria-hidden
    >
      {deskType === "cash_and_carry" ? (
        <CarryIcon />
      ) : deskType === "perps" ? (
        <PerpsIcon />
      ) : deskType === "signal_follower" ? (
        <SignalIcon />
      ) : (
        <DcaIcon />
      )}
    </span>
  );
}

function CarryIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
      <path
        d="M3 6.5h6M9 6.5 7 4.5M9 6.5 7 8.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 9.5H7M7 9.5l2-2M7 9.5l2 2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PerpsIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
      <path
        d="M2.5 11.5 6 8l2.2 2.2L13.5 4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 4.5h3v3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SignalIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
      <path
        d="M8 12.5v-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
      <path
        d="M5.2 6.2a4 4 0 0 1 5.6 0M3.6 4.6a6.2 6.2 0 0 1 8.8 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DcaIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
      <path
        d="M3.5 11.5h3v-6h6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 11.5h9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M8.5 8.5h3v-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PaperIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
      <path
        d="M4.5 2.5h5l2 2v9h-7v-11Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 2.5v2h2M6 8h4M6 10.5h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VenueIcon({ venue }: { venue: string }) {
  if (venue === "hyperliquid") {
    return (
      <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
        <path
          d="M3.5 11.5 8 4.5l4.5 7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5.2 11.5h5.6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (venue === "bybit") {
    return (
      <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
        <path
          d="M4 3.5h5.2c1.7 0 2.8 1 2.8 2.4 0 .9-.5 1.7-1.3 2.1 1 .4 1.6 1.2 1.6 2.2 0 1.6-1.2 2.8-3.1 2.8H4V3.5Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M6.2 6.4h2.4c.7 0 1.1-.4 1.1-1s-.4-1-1.1-1H6.2v2Zm0 4.7h2.8c.8 0 1.3-.5 1.3-1.2s-.5-1.2-1.3-1.2H6.2v2.4Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <span className="text-[10px] font-semibold uppercase">
      {venue.slice(0, 1)}
    </span>
  );
}
