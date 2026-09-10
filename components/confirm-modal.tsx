"use client";

import { useCallback, useRef, useState } from "react";
import { Modal } from "@/components/template-modals";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Pending = ConfirmOptions & {
  resolve: (ok: boolean) => void;
};

const cancelBtn =
  "rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong";
const confirmBtn =
  "rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent";
const dangerBtn =
  "rounded-control bg-danger px-4 py-2 text-sm font-medium text-canvas hover:opacity-90";

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmOptions & {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <Modal title={title} onClose={onCancel} elevated>
      <p className="mt-2 text-sm text-ink-muted">{message}</p>
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
  const pendingRef = useRef<Pending | null>(null);

  const close = useCallback((ok: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(ok);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      if (pendingRef.current) {
        pendingRef.current.resolve(false);
      }
      const next = { ...options, resolve };
      pendingRef.current = next;
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
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, dialog };
}
