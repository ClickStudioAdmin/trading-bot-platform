"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { IconArrowRight, IconClose, IconWarning } from "@/components/icons";
import { useThemePreviewPortalClass } from "@/components/theme-scheme-preview";
import { gateRejectLead } from "@/lib/membership/entitlements";

export const CLICK_GATE_GAP = 8;
export const CLICK_GATE_MARGIN = 8;
export const CLICK_GATE_MAX_WIDTH = 448;

export type ClickGateBox = {
  top: number;
  left: number;
  right: number;
  bottom: number;
};

export type ClickGatePlacement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  side: "below" | "above" | "right" | "left";
};

export type ClickGateItem = {
  message: string;
  upgradePlan: string | null;
};

export type ClickGateAccess = ClickGateItem & {
  items?: readonly ClickGateItem[];
};

function clamp(value: number, min: number, max: number) {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

export function placeClickGate(
  anchor: ClickGateBox,
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
): ClickGatePlacement {
  const margin = CLICK_GATE_MARGIN;
  const gap = CLICK_GATE_GAP;
  const vw = viewport.width;
  const vh = viewport.height;
  const widthCap = Math.max(0, vw - margin * 2);
  const heightCap = Math.max(0, vh - margin * 2);
  const wantWidth = Math.min(
    Math.max(panel.width, 0),
    CLICK_GATE_MAX_WIDTH,
    widthCap,
  );
  const wantHeight = Math.max(panel.height, 0);
  const spaceBelow = vh - margin - (anchor.bottom + gap);
  const spaceAbove = anchor.top - gap - margin;
  const spaceRight = vw - margin - (anchor.right + gap);
  const spaceLeft = anchor.left - gap - margin;

  function finish(
    side: ClickGatePlacement["side"],
    top: number,
    left: number,
    width: number,
    height: number,
  ): ClickGatePlacement {
    const usedWidth = Math.min(Math.max(width, 0), widthCap);
    const usedHeight = Math.min(Math.max(height, 0), heightCap);
    return {
      side,
      width: usedWidth,
      maxHeight: usedHeight,
      left: clamp(left, margin, vw - margin - usedWidth),
      top: clamp(top, margin, vh - margin - usedHeight),
    };
  }

  function alignLeft(width: number) {
    return clamp(anchor.left, margin, vw - margin - width);
  }

  function alignTop(height: number) {
    return clamp(anchor.top, margin, vh - margin - height);
  }

  if (wantWidth > 0 && spaceBelow >= wantHeight) {
    return finish(
      "below",
      anchor.bottom + gap,
      alignLeft(wantWidth),
      wantWidth,
      wantHeight,
    );
  }
  if (wantWidth > 0 && spaceAbove >= wantHeight) {
    return finish(
      "above",
      anchor.top - gap - wantHeight,
      alignLeft(wantWidth),
      wantWidth,
      wantHeight,
    );
  }
  if (spaceRight >= wantWidth && heightCap >= wantHeight && wantWidth > 0) {
    return finish(
      "right",
      alignTop(wantHeight),
      anchor.right + gap,
      wantWidth,
      wantHeight,
    );
  }
  if (spaceLeft >= wantWidth && heightCap >= wantHeight && wantWidth > 0) {
    return finish(
      "left",
      alignTop(wantHeight),
      anchor.left - gap - wantWidth,
      wantWidth,
      wantHeight,
    );
  }

  const belowHeight = Math.min(wantHeight, Math.max(spaceBelow, 0), heightCap);
  const aboveHeight = Math.min(wantHeight, Math.max(spaceAbove, 0), heightCap);
  const rightWidth = Math.min(wantWidth, Math.max(spaceRight, 0), widthCap);
  const leftWidth = Math.min(wantWidth, Math.max(spaceLeft, 0), widthCap);
  const sideHeight = Math.min(wantHeight, heightCap);
  const options: Array<{
    side: ClickGatePlacement["side"];
    area: number;
    width: number;
    height: number;
    top: number;
    left: number;
  }> = [
    {
      side: "below",
      area: wantWidth * belowHeight,
      width: wantWidth,
      height: belowHeight,
      top: anchor.bottom + gap,
      left: alignLeft(wantWidth),
    },
    {
      side: "above",
      area: wantWidth * aboveHeight,
      width: wantWidth,
      height: aboveHeight,
      top: anchor.top - gap - aboveHeight,
      left: alignLeft(wantWidth),
    },
    {
      side: "right",
      area: rightWidth * sideHeight,
      width: rightWidth,
      height: sideHeight,
      top: alignTop(sideHeight),
      left: anchor.right + gap,
    },
    {
      side: "left",
      area: leftWidth * sideHeight,
      width: leftWidth,
      height: sideHeight,
      top: alignTop(sideHeight),
      left: anchor.left - gap - leftWidth,
    },
  ];
  let best = options[0];
  for (const option of options.slice(1)) {
    if (option.area > best.area) {
      best = option;
    }
  }
  return finish(best.side, best.top, best.left, best.width, best.height);
}

function clickGatePortalHost(): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  if (document.fullscreenElement instanceof HTMLElement) {
    return document.fullscreenElement;
  }
  const webkit = (
    document as Document & { webkitFullscreenElement?: Element | null }
  ).webkitFullscreenElement;
  if (webkit instanceof HTMLElement) {
    return webkit;
  }
  return document.body;
}

export function formSubmitAnchor(event: {
  nativeEvent: Event;
  currentTarget: EventTarget | null;
}): HTMLElement | null {
  const native = event.nativeEvent;
  if (native instanceof SubmitEvent && native.submitter instanceof HTMLElement) {
    return native.submitter;
  }
  return event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
}

export function useClickGate() {
  const anchorRef = useRef<HTMLElement | null>(null);
  const [notice, setNotice] = useState<ClickGateAccess | null>(null);
  const [generation, setGeneration] = useState(0);

  const show = useCallback(
    (
      access: {
        message: string | null;
        upgradePlan: string | null;
        items?: readonly ClickGateItem[];
      },
      anchor: EventTarget | null,
    ) => {
      const items = (access.items ?? []).filter((item) => item.message);
      const message = access.message || items[0]?.message || null;
      if (!message || !(anchor instanceof HTMLElement)) {
        return;
      }
      anchorRef.current = anchor;
      setNotice({
        message,
        upgradePlan: access.upgradePlan,
        items: items.length > 1 ? items : undefined,
      });
      setGeneration((current) => current + 1);
    },
    [],
  );

  const hide = useCallback(() => {
    setNotice(null);
  }, []);

  return { notice, anchorRef, generation, show, hide };
}

export function ClickGateNotice({
  access,
  anchorRef,
  generation,
  onDismiss,
}: {
  access: ClickGateAccess | null;
  anchorRef: RefObject<HTMLElement | null>;
  generation: number;
  onDismiss: () => void;
}) {
  const previewClass = useThemePreviewPortalClass();
  const portalHost = clickGatePortalHost();
  const panelRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const scrolledFor = useRef(0);
  const [box, setBox] = useState<ClickGatePlacement | null>(null);

  useLayoutEffect(() => {
    if (!access) {
      return;
    }
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) {
      return;
    }

    function place() {
      const current = anchorRef.current;
      const node = panelRef.current;
      if (!current || !node) {
        return;
      }
      if (!current.isConnected) {
        onDismiss();
        return;
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let rect = current.getBoundingClientRect();
      const offScreen =
        rect.bottom <= 0 ||
        rect.top >= vh ||
        rect.right <= 0 ||
        rect.left >= vw;
      if (offScreen && scrolledFor.current !== generation) {
        current.scrollIntoView({ block: "nearest", inline: "nearest" });
        rect = current.getBoundingClientRect();
      }
      scrolledFor.current = generation;
      const preferred = Math.min(
        CLICK_GATE_MAX_WIDTH,
        Math.max(0, vw - CLICK_GATE_MARGIN * 2),
      );
      node.style.width = `${preferred}px`;
      node.style.maxHeight = "none";
      let height = node.scrollHeight;
      let placed = placeClickGate(
        {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
        },
        { width: preferred, height },
        { width: vw, height: vh },
      );
      if (Math.abs(placed.width - preferred) > 1) {
        node.style.width = `${placed.width}px`;
        height = node.scrollHeight;
        placed = placeClickGate(
          {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
          },
          { width: placed.width, height },
          { width: vw, height: vh },
        );
      }
      node.style.width = `${placed.width}px`;
      node.style.maxHeight = `${placed.maxHeight}px`;
      setBox((currentBox) =>
        currentBox &&
        currentBox.top === placed.top &&
        currentBox.left === placed.left &&
        currentBox.width === placed.width &&
        currentBox.maxHeight === placed.maxHeight &&
        currentBox.side === placed.side
          ? currentBox
          : placed,
      );
    }

    place();
    dismissRef.current?.focus({ preventScroll: true });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const watch = window.setInterval(() => {
      if (!anchorRef.current?.isConnected) {
        onDismiss();
      }
    }, 400);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.clearInterval(watch);
    };
  }, [access, anchorRef, generation, onDismiss]);

  useEffect(() => {
    if (!access) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      onDismiss();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [access, onDismiss]);

  if (!access || !portalHost) {
    return null;
  }

  const items =
    access.items && access.items.length > 1 ? access.items : [access];
  return createPortal(
    <div
      ref={panelRef}
      role="status"
      data-click-gate-notice=""
      className={`fixed z-[70] overflow-y-auto rounded-card border border-warning/30 bg-warning/10 ${previewClass}`.trim()}
      style={{
        top: box?.top ?? 0,
        left: box?.left ?? 0,
        width: box?.width,
        maxHeight: box?.maxHeight,
        visibility: box ? "visible" : "hidden",
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {items.map((item, index) => (
        <ClickGateRow
          key={`${index}:${item.message}`}
          item={item}
          divided={index > 0}
          dismissRef={index === 0 ? dismissRef : undefined}
          onDismiss={index === 0 ? onDismiss : undefined}
        />
      ))}
    </div>,
    portalHost,
  );
}

function ClickGateRow({
  item,
  divided,
  dismissRef,
  onDismiss,
}: {
  item: ClickGateItem;
  divided: boolean;
  dismissRef?: RefObject<HTMLButtonElement | null>;
  onDismiss?: () => void;
}) {
  const lead = gateRejectLead(item.message, item.upgradePlan);
  return (
    <div
      className={`flex flex-wrap items-center gap-2 px-3 py-2.5${
        divided ? " border-t border-warning/25" : ""
      }`}
    >
      <p className="flex min-w-0 flex-1 basis-40 items-start gap-2 text-sm text-warning">
        <IconWarning size={18} className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{lead}</span>
      </p>
      <div className="sticky top-0 flex shrink-0 items-center gap-2">
        {item.upgradePlan ? (
          <Link
            href="/account/plans"
            className="inline-flex items-center gap-1.5 rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
          >
            Upgrade to {item.upgradePlan}
            <IconArrowRight size={14} className="size-3.5" aria-hidden />
          </Link>
        ) : null}
        {onDismiss ? (
          <button
            ref={dismissRef}
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="inline-flex size-7 items-center justify-center rounded-control text-warning hover:bg-warning/15"
          >
            <IconClose size={14} className="size-3.5" />
          </button>
        ) : (
          <span className="size-7 shrink-0" aria-hidden />
        )}
      </div>
    </div>
  );
}
