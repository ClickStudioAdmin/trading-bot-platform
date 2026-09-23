"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { IconChevronRight } from "@/components/icons";

export function ExpandableTradeRows({
  colSpan,
  details,
  children,
  selected = false,
  onSelect,
}: {
  colSpan: number;
  details: ReactNode;
  children: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const panel = panelRef.current;
    const scroller = panel?.closest(".overflow-x-auto");
    if (!(scroller instanceof HTMLElement)) {
      return;
    }
    const measure = () => setPanelWidth(scroller.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [open]);

  return (
    <>
      <tr
        className={`border-b border-line last:border-b-0 ${
          selected ? "bg-accent/10" : ""
        } ${onSelect ? "cursor-pointer" : ""}`}
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
      >
        <td className="w-10 px-2 py-3">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            aria-label={open ? "Hide position details" : "Show position details"}
            onClick={(event) => {
              event.stopPropagation();
              setOpen((current) => !current);
            }}
          >
            <ChevronIcon className={open ? "rotate-90" : undefined} />
          </button>
        </td>
        {children}
      </tr>
      {open ? (
        <tr className="border-b border-line last:border-b-0">
          <td colSpan={colSpan} className="max-w-0 bg-canvas p-0" id={panelId}>
            <div
              ref={panelRef}
              className="sticky left-0 px-4 py-4"
              style={panelWidth == null ? undefined : { width: panelWidth }}
            >
              <div className="min-w-0">{details}</div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function TradeDetailTabs({
  orders,
  logs,
}: {
  orders: ReactNode;
  logs: ReactNode;
}) {
  const [tab, setTab] = useState<"orders" | "logs">("orders");
  const ordersPanelId = useId();
  const logsPanelId = useId();

  return (
    <div className="min-w-0">
      <div
        role="tablist"
        aria-label="Position details"
        className="flex gap-1 border-b border-line"
      >
        <TabButton
          selected={tab === "orders"}
          panelId={ordersPanelId}
          onClick={() => setTab("orders")}
        >
          Orders
        </TabButton>
        <TabButton
          selected={tab === "logs"}
          panelId={logsPanelId}
          onClick={() => setTab("logs")}
        >
          Position logs
        </TabButton>
      </div>
      <div
        className="min-w-0 pt-4"
        role="tabpanel"
        id={tab === "orders" ? ordersPanelId : logsPanelId}
      >
        {tab === "orders" ? orders : logs}
      </div>
    </div>
  );
}

export function TabButton({
  selected,
  panelId,
  onClick,
  children,
}: {
  selected: boolean;
  panelId: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={panelId}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        selected
          ? "border-accent text-ink"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function ChevronIcon({ className }: { className?: string }) {
  return (
    <IconChevronRight size={16} className={`h-4 w-4 ${className ?? ""}`} />
  );
}
