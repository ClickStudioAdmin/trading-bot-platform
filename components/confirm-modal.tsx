"use client";

import { useCallback, useRef, useState } from "react";
import { AppCheck } from "@/components/app-check";
import { Modal } from "@/components/template-modals";

export type ConfirmCheckbox = {
  label: string;
  hint?: string;
  /** Written by the dialog as the box is toggled. Start this false. */
  checked: boolean;
};

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  checkbox?: ConfirmCheckbox;
};

type Pending = ConfirmOptions & {
  resolve: (ok: boolean) => void;
};

const cancelBtn =
  "rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong";
const confirmBtn =
  "rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent";
const dangerBtn =
  "rounded-control bg-danger px-4 py-2 text-sm font-medium text-ink hover:opacity-90";

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  danger = false,
  checkbox,
  checked = false,
  onCheckedChange,
  onConfirm,
  onCancel,
}: ConfirmOptions & {
  open: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <Modal title={title} onClose={onCancel} elevated>
      <p className="mt-2 text-sm text-ink-muted">{message}</p>
      {checkbox ? (
        <label className="mt-4 flex items-start gap-2 text-sm text-ink">
          <AppCheck
            checked={checked}
            onChange={(event) => onCheckedChange?.(event.target.checked)}
          />
          <span>
            {checkbox.label}
            {checkbox.hint ? (
              <span className="mt-1 block text-hint text-ink-muted">
                {checkbox.hint}
              </span>
            ) : null}
          </span>
        </label>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          autoFocus={danger}
          className={cancelBtn}
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          autoFocus={!danger}
          className={danger ? dangerBtn : confirmBtn}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function useConfirmDialog() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [checked, setChecked] = useState(false);
  const pendingRef = useRef<Pending | null>(null);

  const close = useCallback((ok: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    setChecked(false);
    current?.resolve(ok);
  }, []);

  const onCheckedChange = useCallback((next: boolean) => {
    setChecked(next);
    const current = pendingRef.current;
    if (current?.checkbox) {
      current.checkbox.checked = next;
    }
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      if (pendingRef.current) {
        pendingRef.current.resolve(false);
      }
      if (options.checkbox) {
        options.checkbox.checked = false;
      }
      const next = { ...options, resolve };
      pendingRef.current = next;
      setChecked(false);
      setPending(next);
    });
  }, []);

  const dialog = (
    <ConfirmModal
      open={pending != null}
      title={pending?.title ?? ""}
      message={pending?.message ?? ""}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      danger={pending?.danger}
      checkbox={pending?.checkbox}
      checked={checked}
      onCheckedChange={onCheckedChange}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, dialog };
}
