"use client";

import Link from "next/link";
import { forwardRef, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { useThemePreviewPortalClass } from "@/components/theme-scheme-preview";

export const TABLE_ICON_ACTION_CLASS =
  "inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-40";
export const TABLE_ICON_ACTION_DANGER_CLASS =
  "inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-danger/10 hover:text-danger disabled:opacity-40";

export const TABLE_LABEL_BTN_CLASS = {
  primary:
    "inline-flex items-center gap-1.5 rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent disabled:opacity-40",
  secondary:
    "inline-flex items-center gap-1.5 rounded-control border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-40",
  filter:
    "inline-flex items-center gap-1.5 rounded-control border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-40",
  bulk:
    "inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-40",
  danger:
    "inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-sm text-danger hover:bg-danger/10 disabled:opacity-40",
} as const;

export function TableHint({
  box,
  label,
  detail,
}: {
  box: DOMRect | null;
  label: string;
  detail: string;
}) {
  const previewClass = useThemePreviewPortalClass();
  if (!box || typeof document === "undefined") {
    return null;
  }
  return createPortal(
    <span
      role="tooltip"
      className={`pointer-events-none fixed z-50 max-w-56 rounded-control border border-line bg-surface-raised px-3 py-2 text-hint font-normal normal-case tracking-normal text-ink ${previewClass}`.trim()}
      style={{
        top: box.bottom + 8,
        left: Math.max(12, Math.min(box.left, window.innerWidth - 240)),
      }}
    >
      <span className="block text-ink">{label}</span>
      <span className="mt-0.5 block text-ink-muted">{detail}</span>
    </span>,
    document.body,
  );
}

export function useActionHint() {
  const [box, setBox] = useState<DOMRect | null>(null);
  const held = useRef(false);

  function show(event: { currentTarget: HTMLElement }) {
    if (held.current) {
      return;
    }
    setBox(event.currentTarget.getBoundingClientRect());
  }

  function hide() {
    setBox(null);
  }

  function dismiss() {
    held.current = true;
    setBox(null);
  }

  function release() {
    held.current = false;
    setBox(null);
  }

  return {
    box,
    dismiss,
    tip: {
      onMouseEnter: show,
      onMouseLeave: release,
      onFocus: show,
      onBlur: hide,
      onPointerDown: dismiss,
    },
  };
}

export const TABLE_BTN_ICON = { size: 14 as const, className: "size-3.5 shrink-0" };

export const TABLE_ACTIONS_TH_CLASS =
  "w-[1%] whitespace-nowrap px-4 py-3 font-medium";
export const TABLE_ACTIONS_TD_CLASS = "w-[1%] whitespace-nowrap px-4 py-3";

export function TableActions({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex w-max max-w-none shrink-0 flex-nowrap items-center [&_form]:inline-flex ${className}`.trim()}
    >
      {children}
    </div>
  );
}

function LabelIcon({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center [&_svg]:max-h-3.5 [&_svg]:max-w-3.5">
      {children}
    </span>
  );
}

export const TableIconAction = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    detail: string;
    danger?: boolean;
    href?: string;
    target?: string;
    rel?: string;
    onClick?: () => void;
    type?: "button" | "submit";
    form?: string;
    disabled?: boolean;
    className?: string;
    children: ReactNode;
  }
>(function TableIconAction(
  {
    label,
    detail,
    danger = false,
    href,
    target,
    rel,
    onClick,
    type = "button",
    form,
    disabled = false,
    className = "",
    children,
  },
  ref,
) {
  const { box, dismiss, tip } = useActionHint();
  const mark = `${
    danger ? TABLE_ICON_ACTION_DANGER_CLASS : TABLE_ICON_ACTION_CLASS
  } ${className}`.trim();
  const spoken = `${label}. ${detail}`;
  if (href) {
    return (
      <>
        <Link
          href={href}
          target={target}
          rel={rel}
          aria-label={spoken}
          className={mark}
          onClick={dismiss}
          {...tip}
        >
          {children}
        </Link>
        <TableHint box={box} label={label} detail={detail} />
      </>
    );
  }
  return (
    <>
      <button
        ref={ref}
        type={type}
        form={form}
        disabled={disabled}
        aria-label={spoken}
        className={mark}
        onClick={() => {
          dismiss();
          onClick?.();
        }}
        {...tip}
      >
        {children}
      </button>
      <TableHint box={box} label={label} detail={detail} />
    </>
  );
});

export function TablePendingIconAction({
  label,
  detail,
  danger = false,
  pendingLabel,
  className = "",
  children,
  ...rest
}: {
  label: string;
  detail: string;
  danger?: boolean;
  pendingLabel?: string;
  className?: string;
  children: ReactNode;
  name?: string;
  value?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  disabled?: boolean;
  successKey?: string;
  deskAction?: string;
  skipSizeGuard?: boolean;
}) {
  const { box, tip } = useActionHint();
  return (
    <span {...tip} className="inline-flex">
      <PendingSubmitButton
        pendingLabel={pendingLabel ?? `${label}…`}
        aria-label={`${label}. ${detail}`}
        className={`${
          danger ? TABLE_ICON_ACTION_DANGER_CLASS : TABLE_ICON_ACTION_CLASS
        } ${className}`.trim()}
        {...rest}
      >
        {children}
      </PendingSubmitButton>
      <TableHint box={box} label={label} detail={detail} />
    </span>
  );
}

export function TableLabelButton({
  icon,
  children,
  variant = "secondary",
  href,
  onClick,
  type = "button",
  disabled = false,
  className = "",
}: {
  icon: ReactNode;
  children: ReactNode;
  variant?: keyof typeof TABLE_LABEL_BTN_CLASS;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const mark = `${TABLE_LABEL_BTN_CLASS[variant]} ${className}`.trim();
  const leading = <LabelIcon>{icon}</LabelIcon>;
  if (href) {
    return (
      <Link href={href} className={mark}>
        {leading}
        {children}
      </Link>
    );
  }
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={mark}>
      {leading}
      {children}
    </button>
  );
}

export function TablePendingLabelButton({
  icon,
  children,
  variant = "bulk",
  pendingLabel,
  disabled = false,
  className = "",
  ...rest
}: {
  icon: ReactNode;
  children: ReactNode;
  variant?: keyof typeof TABLE_LABEL_BTN_CLASS;
  pendingLabel?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
  value?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  successKey?: string;
  deskAction?: string;
  skipSizeGuard?: boolean;
}) {
  return (
    <PendingSubmitButton
      pendingLabel={pendingLabel}
      disabled={disabled}
      className={`${TABLE_LABEL_BTN_CLASS[variant]} ${className}`.trim()}
      {...rest}
    >
      <LabelIcon>{icon}</LabelIcon>
      {children}
    </PendingSubmitButton>
  );
}
