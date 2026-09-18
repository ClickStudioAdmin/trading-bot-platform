import type { DeskType, TradingAccount } from "@/lib/accounts/model";
import {
  formatAccountMode,
  formatDeskType,
  formatDeskVenueCaption,
} from "@/lib/accounts/model";
import {
  IconBybit,
  IconCarry,
  IconDca,
  IconHyperliquid,
  IconPaper,
  IconPerps,
  IconSignal,
} from "@/components/icons";

const DESK_ICON = { size: 16, className: "size-4" } as const;
const TYPE_ICON = { size: 14, className: "size-3.5" } as const;

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
        <IconPaper {...DESK_ICON} />
      ) : (
        <VenueIcon venue={desk.venue} />
      )}
    </span>
  );
}

export function DeskTypeMark({ deskType }: { deskType: DeskType }) {
  return (
    <span
      className="inline-flex size-4 shrink-0 items-center justify-center"
      title={formatDeskType(deskType)}
      aria-hidden
    >
      {deskType === "cash_and_carry" ? (
        <IconCarry {...TYPE_ICON} />
      ) : deskType === "perps" || deskType === "perps_bots" ? (
        <IconPerps {...TYPE_ICON} />
      ) : deskType === "signal_follower" ? (
        <IconSignal {...TYPE_ICON} />
      ) : (
        <IconDca {...TYPE_ICON} />
      )}
    </span>
  );
}

function VenueIcon({ venue }: { venue: string }) {
  if (venue === "hyperliquid") {
    return <IconHyperliquid {...DESK_ICON} />;
  }
  if (venue === "bybit") {
    return <IconBybit {...DESK_ICON} />;
  }
  return (
    <span className="text-[10px] font-semibold uppercase">
      {venue.slice(0, 1)}
    </span>
  );
}
