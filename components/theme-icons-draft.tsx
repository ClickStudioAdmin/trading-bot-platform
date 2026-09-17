"use client";

import { type ReactNode } from "react";
import { EnableCheck } from "@/components/bot-form-chrome";
import { ButtonBusyIcon, ButtonCheckIcon } from "@/components/pending-submit-button";
import { TokenIcon } from "@/components/token-icon";
import { ChevronIcon } from "@/components/trade-expand";

export function ThemeIconsDraft() {
  return (
    <div className="space-y-8">
      <IconGroup
        title="Chrome"
        note="Inline SVGs. There is no icon pack in the app."
      >
        <IconTile name="Busy">
          <ButtonBusyIcon />
        </IconTile>
        <IconTile name="Check">
          <ButtonCheckIcon />
        </IconTile>
        <IconTile name="Chevron">
          <ChevronIcon />
        </IconTile>
        <IconTile name="Chevron down">
          <ChevronDownIcon />
        </IconTile>
        <IconTile name="Close">
          <CloseIcon />
        </IconTile>
        <IconTile name="Pencil">
          <PencilIcon />
        </IconTile>
        <IconTile name="Star">
          <StarIcon filled={false} />
        </IconTile>
        <IconTile name="Star filled">
          <StarIcon filled />
        </IconTile>
        <IconTile name="Enable off">
          <EnableCheck checked={false} />
        </IconTile>
        <IconTile name="Enable on">
          <EnableCheck checked />
        </IconTile>
      </IconGroup>

      <IconGroup title="Desk marks" note="Paper / venue / desk type.">
        <IconTile name="Paper">
          <PaperIcon />
        </IconTile>
        <IconTile name="Bybit">
          <BybitIcon />
        </IconTile>
        <IconTile name="Hyperliquid">
          <HyperliquidIcon />
        </IconTile>
        <IconTile name="DCA">
          <DcaIcon />
        </IconTile>
        <IconTile name="Perps">
          <PerpsIcon />
        </IconTile>
        <IconTile name="Cash and Carry">
          <CarryIcon />
        </IconTile>
        <IconTile name="Signal">
          <SignalIcon />
        </IconTile>
      </IconGroup>

      <IconGroup title="Chart" note="Desk chart toolbar.">
        <IconTile name="Copy image">
          <CopyImageIcon />
        </IconTile>
        <IconTile name="Camera">
          <CameraIcon />
        </IconTile>
        <IconTile name="Expand">
          <ExpandIcon />
        </IconTile>
        <IconTile name="Collapse">
          <CollapseIcon />
        </IconTile>
        <IconTile name="Monitor">
          <MonitorIcon />
        </IconTile>
        <IconTile name="Exit monitor">
          <ExitMonitorIcon />
        </IconTile>
        <IconTile name="Copied">
          <ChartCheckIcon />
        </IconTile>
      </IconGroup>

      <IconGroup
        title="Market tokens"
        note="Not UI chrome. Live pair images from /api/market/icons."
      >
        <IconTile name="BTC">
          <TokenIcon symbol="BTC" size={24} />
        </IconTile>
        <IconTile name="ETH">
          <TokenIcon symbol="ETH" size={24} />
        </IconTile>
        <IconTile name="SOL">
          <TokenIcon symbol="SOL" size={24} />
        </IconTile>
      </IconGroup>
    </div>
  );
}

function IconGroup({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{note}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {children}
      </div>
    </section>
  );
}

function IconTile({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-raised text-ink">
        {children}
      </span>
      <p className="min-w-0 text-sm text-ink">{name}</p>
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
      <path
        d="M3 4.5 6 8l3-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-3.5">
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-3.5">
      <path
        d="M10.5 2.5 13.5 5.5 6 13H3V10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      <path
        d="M8 1.6 9.76 5.17l3.94.57-2.85 2.78.67 3.92L8 10.6l-3.52 1.84.67-3.92-2.85-2.78 3.94-.57L8 1.6Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
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

function HyperliquidIcon() {
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

function BybitIcon() {
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

function CopyImageIcon() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" fill="none" aria-hidden>
      <rect
        x="6.25"
        y="6.25"
        width="8"
        height="8"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M11.5 6.1V4.7A1.2 1.2 0 0 0 10.3 3.5H4.7A1.2 1.2 0 0 0 3.5 4.7v5.6A1.2 1.2 0 0 0 4.7 11.5H6.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" fill="none" aria-hidden>
      <path
        d="M3.5 7.25V3.5H7.25"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 7.25V3.5H10.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 10.75V14.5H7.25"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 10.75V14.5H10.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" fill="none" aria-hidden>
      <path
        d="M7.25 3.5V7.25H3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.75 3.5V7.25H14.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.25 14.5V10.75H3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.75 14.5V10.75H14.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="3.5"
        width="13"
        height="9"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M7 14.5h4M9 12.5v2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExitMonitorIcon() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="3.5"
        width="13"
        height="9"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M7 14.5h4M9 12.5v2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M6.2 6.2 8 8M11.8 6.2 10 8M6.2 10.3 8 8.5M11.8 10.3 10 8.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" fill="none" aria-hidden>
      <path
        d="M3.6 6.6h1.85l1.1-1.55h4.9L12.55 6.6H14.4A1.6 1.6 0 0 1 16 8.2v5.2a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 13.4V8.2a1.6 1.6 0 0 1 1.6-1.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle
        cx="9"
        cy="10.7"
        r="2.15"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function ChartCheckIcon() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" fill="none" aria-hidden>
      <path
        d="M4.5 9.2 7.4 12l6.1-6.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
