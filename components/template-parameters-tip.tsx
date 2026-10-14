"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { BacktestParameterSections } from "@/components/backtest-parameter-sections";
import { IconBacktest, IconInfo } from "@/components/icons";
import { useThemePreviewPortalClass } from "@/components/theme-scheme-preview";
import { attachedBacktestLinksAction } from "@/lib/backtest/actions";
import { templateParamSections } from "@/lib/backtest/param-sections";
import type { TemplateBacktestLink } from "@/lib/backtest/model";
import type { TemplateRecipe } from "@/lib/templates/recipe";
import { formatAuDateUtc } from "@/lib/time/display";

const POPUP_WIDTH = 416;
const POPUP_MAX_HEIGHT = 560;
const POPUP_MARGIN = 24;

export function TemplateParametersButton({
  name,
  recipe,
  templateId = null,
  backtests = null,
  className = "",
}: {
  name: string;
  recipe: TemplateRecipe | null | undefined;
  templateId?: string | null;
  /** When set, skip the lookup and show these runs. Null loads attached runs for `templateId`. */
  backtests?: TemplateBacktestLink[] | null;
  className?: string;
}) {
  const sections = recipe ? templateParamSections(recipe) : [];
  const requestId = useRef<string | null>(null);
  const [loadedBacktests, setLoadedBacktests] = useState<
    TemplateBacktestLink[] | null
  >(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const shownBacktests =
    backtests ?? (loadedFor === templateId ? loadedBacktests : null);
  const popupId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupTab, setPopupTab] = useState<"parameters" | "backtests">(
    "parameters",
  );
  const pinned = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    bodyMax: number;
  } | null>(null);
  const previewClass = useThemePreviewPortalClass();

  function clearClose() {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    if (pinned.current) {
      return;
    }
    clearClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  }

  useEffect(() => () => clearClose(), []);

  function loadBacktests() {
    if (!templateId || backtests || requestId.current === templateId) {
      return;
    }
    const id = templateId;
    requestId.current = id;
    void attachedBacktestLinksAction(id)
      .then((rows) => {
        if (requestId.current !== id) {
          return;
        }
        setLoadedFor(id);
        setLoadedBacktests(rows);
      })
      .catch(() => {
        if (requestId.current !== id) {
          return;
        }
        setLoadedFor(id);
        setLoadedBacktests([]);
      });
  }

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    function place() {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const panel = popupRef.current;
      if (!anchor || !panel) {
        return;
      }
      const margin = POPUP_MARGIN;
      const gap = 8;
      const width = Math.min(POPUP_WIDTH, window.innerWidth - margin * 2);
      const maxHeight = Math.min(
        POPUP_MAX_HEIGHT,
        window.innerHeight - margin * 2,
      );
      let left = anchor.right + gap;
      if (left + width > window.innerWidth - margin) {
        left = anchor.left - gap - width;
      }
      if (left < margin) {
        left = margin;
      }
      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      const bodyMax = Math.max(160, maxHeight - 34 - headerHeight);
      const bodyEl = panel.querySelector<HTMLElement>("[data-parameters-body]");
      const visibleBody = Math.min(bodyEl?.scrollHeight ?? 0, bodyMax);
      const height = Math.min(34 + headerHeight + visibleBody, maxHeight);
      let top = anchor.top;
      if (top + height > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - margin - height);
      }
      setBox((current) =>
        current &&
        current.top === top &&
        current.left === left &&
        current.width === width &&
        current.maxHeight === maxHeight &&
        current.bodyMax === bodyMax
          ? current
          : { top, left, width, maxHeight, bodyMax },
      );
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, popupTab, sections.length, shownBacktests?.length]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (
        anchorRef.current?.contains(target) ||
        popupRef.current?.contains(target)
      ) {
        return;
      }
      pinned.current = false;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        pinned.current = false;
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!recipe) {
    return null;
  }

  const hasBacktests = (shownBacktests?.length ?? 0) > 0;

  function showPopup(tab?: "parameters" | "backtests") {
    clearClose();
    if (tab) {
      setPopupTab(tab);
    }
    setOpen(true);
    loadBacktests();
  }

  function onClick(
    tab: "parameters" | "backtests",
    event: ReactMouseEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    clearClose();
    if (open && pinned.current && popupTab === tab) {
      pinned.current = false;
      setOpen(false);
      return;
    }
    pinned.current = true;
    setPopupTab(tab);
    setOpen(true);
    loadBacktests();
  }

  const iconClass =
    `inline-flex size-5 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink ${className}`.trim();

  return (
    <>
      <span ref={anchorRef} className="inline-flex shrink-0 items-center">
        <button
          ref={buttonRef}
          type="button"
          data-template-parameters=""
          aria-label={`Parameters for ${name}`}
          aria-expanded={open}
          aria-controls={open ? popupId : undefined}
          onMouseEnter={() => showPopup("parameters")}
          onMouseLeave={scheduleClose}
          onFocus={() => showPopup("parameters")}
          onBlur={scheduleClose}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => onClick("parameters", event)}
          className={iconClass}
        >
          <IconInfo size={14} className="size-3.5" />
        </button>
        {hasBacktests ? (
          <button
            type="button"
            data-template-parameters=""
            aria-label={`Backtests for ${name}`}
            aria-expanded={open && popupTab === "backtests"}
            aria-controls={open ? popupId : undefined}
            onMouseEnter={() => showPopup("backtests")}
            onMouseLeave={scheduleClose}
            onFocus={() => showPopup("backtests")}
            onBlur={scheduleClose}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => onClick("backtests", event)}
            className={iconClass}
          >
            <IconBacktest size={14} className="size-3.5" />
          </button>
        ) : null}
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popupRef}
              id={popupId}
              role="dialog"
              aria-label={
                popupTab === "backtests"
                  ? `${name} backtests`
                  : `${name} parameters`
              }
              data-template-parameters=""
              onMouseEnter={() => showPopup()}
              onMouseLeave={scheduleClose}
              className={`fixed z-[90] flex flex-col overflow-hidden rounded-card border border-line bg-canvas p-4 text-left font-normal normal-case tracking-normal text-ink shadow-none ${previewClass}`.trim()}
              style={{
                top: box?.top ?? -9999,
                left: box?.left ?? POPUP_MARGIN,
                width: box?.width ?? POPUP_WIDTH,
                maxHeight: box?.maxHeight ?? POPUP_MAX_HEIGHT,
              }}
            >
              <div ref={headerRef} className="shrink-0 pb-3">
                {hasBacktests ? (
                  <nav
                    role="tablist"
                    aria-label={`${name} details`}
                    className="flex border-b border-line"
                  >
                    <PopupTab
                      selected={popupTab === "parameters"}
                      onClick={() => setPopupTab("parameters")}
                    >
                      Parameters
                    </PopupTab>
                    <PopupTab
                      selected={popupTab === "backtests"}
                      onClick={() => setPopupTab("backtests")}
                    >
                      Backtests
                    </PopupTab>
                  </nav>
                ) : (
                  <h2 className="text-lg font-semibold">Parameters</h2>
                )}
              </div>
              <div
                data-parameters-body=""
                className="min-h-0 overflow-y-auto"
                style={{ maxHeight: box?.bodyMax ?? POPUP_MAX_HEIGHT }}
              >
                {popupTab === "backtests" && hasBacktests ? (
                  <ul className="overflow-hidden rounded-card border border-line bg-surface">
                    {shownBacktests?.map((run) => (
                      <li
                        key={run.runId}
                        className="border-b border-line last:border-b-0"
                      >
                        <a
                          href={`/account/backtests/${run.runId}`}
                          target="_blank"
                          rel="noreferrer"
                          data-template-parameters=""
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                          className="flex items-baseline justify-between gap-4 px-5 py-2.5 text-sm font-medium text-accent hover:underline"
                        >
                          <span className="min-w-0 text-left break-words">
                            {run.name}
                          </span>
                          <span className="shrink-0 text-right text-xs font-normal tabular-nums text-ink-muted">
                            {formatAuDateUtc(run.fromMs)} – {formatAuDateUtc(run.toMs)}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : sections.length > 0 ? (
                  <BacktestParameterSections sections={sections} />
                ) : (
                  <p className="text-sm text-ink-muted">No parameters stored.</p>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function PopupTab({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      data-template-parameters=""
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        selected
          ? "border-accent text-ink"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function TemplateNameWithParameters({
  name,
  recipe,
  templateId = null,
  backtests = null,
  className = "",
  nameClassName = "min-w-0 break-words",
}: {
  name: string;
  recipe: TemplateRecipe | null | undefined;
  templateId?: string | null;
  backtests?: TemplateBacktestLink[] | null;
  className?: string;
  nameClassName?: string;
}) {
  return (
    <span className={`inline-flex max-w-full items-start gap-1 ${className}`.trim()}>
      <span className={nameClassName}>{name}</span>
      <TemplateParametersButton
        name={name}
        recipe={recipe}
        templateId={templateId}
        backtests={backtests}
      />
    </span>
  );
}
