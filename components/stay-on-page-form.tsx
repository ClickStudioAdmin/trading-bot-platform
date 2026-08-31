"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { DeskActionResult } from "@/lib/ui/desk-action";

const OK_MS = 1500;

type DeskFormStatus = {
  active: boolean;
  pending: boolean;
  pendingAction: string | null;
  ok: boolean;
  okAction: string | null;
  error: string | null;
  notice: string | null;
};

const idleStatus: DeskFormStatus = {
  active: false,
  pending: false,
  pendingAction: null,
  ok: false,
  okAction: null,
  error: null,
  notice: null,
};

const DeskFormContext = createContext<DeskFormStatus>(idleStatus);

export function useDeskFormStatus(): DeskFormStatus {
  return useContext(DeskFormContext);
}

export function DeskFormFlash({ className }: { className?: string }) {
  const { error, notice } = useDeskFormStatus();
  if (error) {
    return (
      <p
        className={
          className ??
          "rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        }
        role="alert"
      >
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p className={className ?? "text-sm text-success"} role="status">
        {notice}
      </p>
    );
  }
  return null;
}

export function keepFormKeys<T extends { id: string; key: string }>(
  current: T[],
  saved: T[],
): T[] {
  const pool = [...current];
  return saved.map((row) => {
    const idIndex = row.id
      ? pool.findIndex((item) => item.id === row.id)
      : -1;
    if (idIndex >= 0) {
      const [match] = pool.splice(idIndex, 1);
      return { ...row, key: match.key };
    }
    const draftIndex = pool.findIndex((item) => !item.id);
    if (draftIndex >= 0) {
      const [match] = pool.splice(draftIndex, 1);
      return { ...row, key: match.key };
    }
    return row;
  });
}

export const StayOnPageForm = forwardRef<
  HTMLFormElement,
  {
    action: (data: FormData) => Promise<DeskActionResult>;
    actions?: Record<string, (data: FormData) => Promise<DeskActionResult>>;
    onResult?: (result: DeskActionResult) => void;
    guard?: (event: FormEvent<HTMLFormElement>) => boolean;
    className?: string;
    noValidate?: boolean;
    children: ReactNode;
  }
>(function StayOnPageForm(
  { action, actions, onResult, guard, className, noValidate = false, children },
  ref,
) {
  const [pending, setPending] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [okAction, setOkAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const okTimer = useRef(0);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guard && !guard(event)) {
      return;
    }
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | null;
    const data = new FormData(event.currentTarget, submitter);
    const key = submitter?.dataset.deskAction || "default";
    const fn = (key !== "default" && actions?.[key]) || action;
    setPending(true);
    setPendingAction(key);
    setError(null);
    setOk(false);
    setOkAction(null);
    try {
      const result = await fn(data);
      if (!result.ok) {
        setNotice(null);
        setError(result.error ?? "That did not work.");
        onResult?.(result);
        return;
      }
      setError(null);
      setNotice(result.notice ?? null);
      setOk(true);
      setOkAction(key);
      window.clearTimeout(okTimer.current);
      okTimer.current = window.setTimeout(() => {
        setOk(false);
        setOkAction(null);
      }, OK_MS);
      onResult?.(result);
    } finally {
      setPending(false);
      setPendingAction(null);
    }
  }

  return (
    <form
      ref={ref}
      noValidate={noValidate}
      onSubmit={(event) => void onSubmit(event)}
      className={className}
    >
      <DeskFormContext.Provider
        value={{
          active: true,
          pending,
          pendingAction,
          ok,
          okAction,
          error,
          notice,
        }}
      >
        {children}
      </DeskFormContext.Provider>
    </form>
  );
});

StayOnPageForm.displayName = "StayOnPageForm";
