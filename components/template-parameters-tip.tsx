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
import { IconInfo } from "@/components/icons";
import { useThemePreviewPortalClass } from "@/components/theme-scheme-preview";
import { templateParamSections } from "@/lib/backtest/param-sections";
import type { TemplateRecipe } from "@/lib/templates/recipe";

const POPUP_WIDTH = 416;
const POPUP_MAX_HEIGHT = 560;

export function TemplateParametersButton({
  name,
  recipe,
  className = "",
}: {
  name: string;
  recipe: TemplateRecipe | null | undefined;
  className?: string;
}) {
  const sections = recipe ? templateParamSections(recipe) : [];
  const popupId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
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

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    function place() {
      const anchor = buttonRef.current?.getBoundingClientRect();
      const panel = popupRef.current;
      if (!anchor || !panel) {
        return;
      }
      const margin = 12;
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
      const height = Math.min(panel.offsetHeight || maxHeight, maxHeight);
      let top = anchor.top;
      if (top + height > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - margin - height);
      }
      setBox((current) =>
        current &&
        current.top === top &&
        current.left === left &&
        current.width === width &&
        current.maxHeight === maxHeight
          ? current
          : { top, left, width, maxHeight },
      );
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, sections.length]);

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
        buttonRef.current?.contains(target) ||
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

  function onEnter() {
    clearClose();
    setOpen(true);
  }

  function onClick(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    clearClose();
    if (open && pinned.current) {
      pinned.current = false;
      setOpen(false);
      return;
    }
    pinned.current = true;
    setOpen(true);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-template-parameters=""
        aria-label={`Parameters for ${name}`}
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        onMouseEnter={onEnter}
        onMouseLeave={scheduleClose}
        onFocus={onEnter}
        onBlur={scheduleClose}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={onClick}
        className={`inline-flex size-5 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink ${className}`.trim()}
      >
        <IconInfo size={14} className="size-3.5" />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popupRef}
              id={popupId}
              role="dialog"
              aria-label={`${name} parameters`}
              data-template-parameters=""
              onMouseEnter={onEnter}
              onMouseLeave={scheduleClose}
              className={`fixed z-[90] overflow-auto rounded-card border border-line bg-canvas p-3 text-left font-normal normal-case tracking-normal text-ink shadow-none ${previewClass}`.trim()}
              style={{
                top: box?.top ?? -9999,
                left: box?.left ?? 12,
                width: box?.width ?? POPUP_WIDTH,
                maxHeight: box?.maxHeight ?? POPUP_MAX_HEIGHT,
              }}
            >
              <h2 className="mb-3 text-lg font-semibold">Parameters</h2>
              {sections.length > 0 ? (
                <BacktestParameterSections sections={sections} />
              ) : (
                <p className="text-sm text-ink-muted">No parameters stored.</p>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function TemplateNameWithParameters({
  name,
  recipe,
  className = "",
  nameClassName = "min-w-0 break-words",
}: {
  name: string;
  recipe: TemplateRecipe | null | undefined;
  className?: string;
  nameClassName?: string;
}) {
  return (
    <span className={`inline-flex max-w-full items-start gap-1 ${className}`.trim()}>
      <span className={nameClassName}>{name}</span>
      <TemplateParametersButton name={name} recipe={recipe} />
    </span>
  );
}
