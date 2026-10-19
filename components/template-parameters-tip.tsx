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
import { BacktestHighlightBody } from "@/components/backtest-highlight-hover";
import { IconBacktest, IconInfo } from "@/components/icons";
import { useThemePreviewPortalClass } from "@/components/theme-scheme-preview";
import { attachedBacktestsByTemplateAction } from "@/lib/backtest/actions";
import { backtestsForBotRecipesAction } from "@/lib/backtest/desk-bot-action";
import { templateParamSections } from "@/lib/backtest/param-sections";
import type { TemplateBacktestLink } from "@/lib/backtest/model";
import type { TemplateRecipe } from "@/lib/templates/recipe";
import { formatAuDateUtc } from "@/lib/time/display";

const POPUP_WIDTH = 416;
const POPUP_MAX_HEIGHT = 560;
const POPUP_MARGIN = 24;
const ATTACHED_BATCH = 200;

type AttachedWaiter = {
  id: string;
  resolve: (rows: TemplateBacktestLink[]) => void;
  reject: (error: unknown) => void;
};

let attachedQueue: AttachedWaiter[] = [];
let attachedFlush: number | null = null;

function enqueueAttachedBacktests(
  templateId: string,
): Promise<TemplateBacktestLink[]> {
  return new Promise((resolve, reject) => {
    attachedQueue.push({ id: templateId, resolve, reject });
    if (attachedFlush != null) {
      return;
    }
    attachedFlush = window.setTimeout(() => {
      attachedFlush = null;
      const batch = attachedQueue;
      attachedQueue = [];
      const ids = [...new Set(batch.map((item) => item.id))];
      const chunks: string[][] = [];
      for (let index = 0; index < ids.length; index += ATTACHED_BATCH) {
        chunks.push(ids.slice(index, index + ATTACHED_BATCH));
      }
      void Promise.all(chunks.map((chunk) => attachedBacktestsByTemplateAction(chunk)))
        .then((maps) => {
          const merged: Record<string, TemplateBacktestLink[]> = {};
          for (const map of maps) {
            Object.assign(merged, map);
          }
          for (const item of batch) {
            item.resolve(merged[item.id] ?? []);
          }
        })
        .catch((error: unknown) => {
          for (const item of batch) {
            item.reject(error);
          }
        });
    }, 0);
  });
}

type BotBacktestWaiter = {
  id: string;
  recipe: TemplateRecipe;
  resolve: (rows: TemplateBacktestLink[]) => void;
};

let botBacktestQueue: BotBacktestWaiter[] = [];
let botBacktestFlush: number | null = null;

function enqueueBotBacktests(
  id: string,
  recipe: TemplateRecipe,
): Promise<TemplateBacktestLink[]> {
  return new Promise((resolve) => {
    botBacktestQueue.push({ id, recipe, resolve });
    if (botBacktestFlush != null) {
      return;
    }
    botBacktestFlush = window.setTimeout(() => {
      botBacktestFlush = null;
      const batch = botBacktestQueue;
      botBacktestQueue = [];
      void backtestsForBotRecipesAction(
        batch.map((item) => ({ id: item.id, recipe: item.recipe })),
      )
        .then((map) => {
          for (const item of batch) {
            item.resolve(map[item.id] ?? []);
          }
        })
        .catch(() => {
          for (const item of batch) {
            item.resolve([]);
          }
        });
    }, 0);
  });
}

export function BotParametersButton({
  name,
  recipe,
  botId,
}: {
  name: string;
  recipe: TemplateRecipe;
  botId: string;
}) {
  const key = `${recipe.kind}:${botId}`;
  const recipeRef = useRef(recipe);
  const [backtests, setBacktests] = useState<TemplateBacktestLink[] | null>(
    null,
  );
  useEffect(() => {
    recipeRef.current = recipe;
  }, [recipe]);
  useEffect(() => {
    let cancelled = false;
    void enqueueBotBacktests(key, recipeRef.current).then((rows) => {
      if (!cancelled) {
        setBacktests(rows);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return (
    <TemplateParametersButton
      name={name}
      recipe={recipe}
      backtests={backtests ?? undefined}
    />
  );
}

export function TemplateParametersButton({
  name,
  description = null,
  recipe,
  templateId = null,
  backtests = null,
  trigger = "parameters",
  className = "",
}: {
  name: string;
  description?: string | null;
  recipe: TemplateRecipe | null | undefined;
  templateId?: string | null;
  /** When set, skip the lookup and show these runs. Null loads attached runs as soon as the button is shown. */
  backtests?: TemplateBacktestLink[] | null;
  /** parameters: the info button opens Parameters. backtests: the flask opens the Backtests tab. */
  trigger?: "parameters" | "backtests";
  className?: string;
}) {
  const descriptionText = description?.trim() ?? "";
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
    trigger === "backtests" ? "backtests" : "parameters",
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
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      if (pinned.current) {
        return;
      }
      setOpen(false);
    }, 140);
  }

  useEffect(() => () => clearClose(), []);

  useEffect(() => {
    loadBacktests();
  }, [templateId, backtests]);

  function loadBacktests() {
    if (!templateId || backtests || requestId.current === templateId) {
      return;
    }
    const id = templateId;
    requestId.current = id;
    void enqueueAttachedBacktests(id)
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
      const path = event.composedPath();
      if (
        (anchorRef.current && path.includes(anchorRef.current)) ||
        (popupRef.current && path.includes(popupRef.current)) ||
        anchorRef.current?.contains(target) ||
        popupRef.current?.contains(target)
      ) {
        pinned.current = true;
        clearClose();
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

  if (!recipe && trigger !== "backtests") {
    return null;
  }

  const hasBacktests = (shownBacktests?.length ?? 0) > 0;
  const showTabs = trigger === "backtests" || hasBacktests;

  function showPopup(tab?: "parameters" | "backtests") {
    clearClose();
    if (tab) {
      setPopupTab(tab);
    }
    setOpen(true);
    loadBacktests();
  }

  function selectPopupTab(tab: "parameters" | "backtests") {
    pinned.current = true;
    clearClose();
    setPopupTab(tab);
    setOpen(true);
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
    `inline-flex size-5 shrink-0 items-center justify-center rounded-control hover:bg-surface-raised ${
      trigger === "backtests"
        ? "text-accent hover:text-accent"
        : "text-ink-muted hover:text-ink"
    } ${className}`.trim();

  return (
    <>
      <span ref={anchorRef} className="inline-flex shrink-0 items-center">
        {trigger === "backtests" ? (
          <button
            ref={buttonRef}
            type="button"
            data-template-parameters=""
            aria-label={`Backtests for ${name}`}
            aria-expanded={open}
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
        ) : (
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
        )}
        {trigger === "parameters" && hasBacktests ? (
          <span
            role="img"
            data-template-parameters=""
            aria-label={`Backtests attached for ${name}`}
            onMouseEnter={clearClose}
            onMouseLeave={scheduleClose}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            className="inline-flex size-5 shrink-0 cursor-default items-center justify-center text-ink-muted"
          >
            <IconBacktest size={14} className="size-3.5" />
          </span>
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
              onMouseDown={(event) => {
                event.stopPropagation();
                event.nativeEvent.stopPropagation();
                pinned.current = true;
                clearClose();
              }}
              className={`fixed z-[90] flex flex-col overflow-hidden rounded-card border border-line bg-canvas p-4 text-left font-normal normal-case tracking-normal text-ink shadow-none ${previewClass}`.trim()}
              style={{
                top: box?.top ?? -9999,
                left: box?.left ?? POPUP_MARGIN,
                width: box?.width ?? POPUP_WIDTH,
                maxHeight: box?.maxHeight ?? POPUP_MAX_HEIGHT,
              }}
            >
              <div ref={headerRef} className="shrink-0 pb-3">
                {showTabs ? (
                  <nav
                    role="tablist"
                    aria-label={`${name} details`}
                    className="flex border-b border-line"
                  >
                    <PopupTab
                      selected={popupTab === "parameters"}
                      onClick={() => selectPopupTab("parameters")}
                    >
                      Parameters
                    </PopupTab>
                    <PopupTab
                      selected={popupTab === "backtests"}
                      onClick={() => selectPopupTab("backtests")}
                    >
                      Backtests
                    </PopupTab>
                  </nav>
                ) : (
                  <h2 className="text-lg font-semibold">Parameters</h2>
                )}
                {descriptionText ? (
                  <p className="mt-3 text-sm whitespace-pre-wrap break-words text-ink-muted">
                    {descriptionText}
                  </p>
                ) : null}
              </div>
              <div
                data-parameters-body=""
                className="min-h-0 overflow-y-auto"
                style={{ maxHeight: box?.bodyMax ?? POPUP_MAX_HEIGHT }}
              >
                {popupTab === "backtests" && showTabs ? (
                  shownBacktests == null ? (
                    <p className="text-sm text-ink-muted">Loading backtests…</p>
                  ) : hasBacktests ? (
                    <ul className="space-y-2">
                      {shownBacktests.map((run) => (
                        <li key={run.runId}>
                          <a
                            href={`/account/backtests/${run.runId}`}
                            target="_blank"
                            rel="noreferrer"
                            data-template-parameters=""
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            className="block rounded-control border border-line bg-surface-raised px-3 py-2 text-ink"
                          >
                            <span className="mb-2 block text-sm font-medium text-accent">
                              {run.name}
                            </span>
                            {run.highlight ? (
                              <BacktestHighlightBody highlight={run.highlight} />
                            ) : (
                              <span className="text-xs tabular-nums text-ink-muted">
                                {formatAuDateUtc(run.fromMs)} –{" "}
                                {formatAuDateUtc(run.toMs)}
                              </span>
                            )}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-ink-muted">No backtests attached.</p>
                  )
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
      onMouseDown={(event) => {
        event.stopPropagation();
        event.nativeEvent.stopPropagation();
        onClick();
      }}
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
  description = null,
  recipe,
  templateId = null,
  backtests = null,
  className = "",
  nameClassName = "min-w-0 break-words",
}: {
  name: string;
  description?: string | null;
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
        description={description}
        recipe={recipe}
        templateId={templateId}
        backtests={backtests}
      />
    </span>
  );
}
