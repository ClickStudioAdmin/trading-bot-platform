"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

const OK_KEY = "tbp-btn-ok";
const OK_MS = 1500;

export function ButtonBusyIcon() {
  return (
    <span
      className="inline-block size-3 shrink-0 animate-spin rounded-full border border-current border-t-transparent"
      aria-hidden
    />
  );
}

export function ButtonCheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="size-3 text-success"
    >
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function queryLooksSuccessful() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("paperError") || params.get("error")) {
    return false;
  }
  const paper = params.get("paper");
  return (
    paper === "opened" ||
    paper === "closed" ||
    paper === "unwinding" ||
    paper === "live-opened" ||
    paper === "live-added" ||
    paper === "live-closed" ||
    paper === "live-unwinding" ||
    paper === "working" ||
    paper === "live-working" ||
    paper === "cancelled" ||
    paper === "amended" ||
    paper === "live-amended" ||
    paper === "added" ||
    paper === "tpsl" ||
    paper === "live-tpsl" ||
    paper === "trailing" ||
    paper === "live-trailing" ||
    paper === "exits" ||
    params.get("saved") === "1" ||
    params.get("saved") === "profile" ||
    params.get("saved") === "password" ||
    params.get("reduce") === "1" ||
    params.get("removed") === "1" ||
    params.get("renamed") === "1" ||
    paper === "webhook-arm" ||
    params.get("created") === "1"
  );
}

export function useStoredButtonSuccess(successKey: string | undefined) {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!successKey) {
      return;
    }
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(OK_KEY);
    } catch {
      return;
    }
    if (stored !== successKey) {
      return;
    }
    try {
      sessionStorage.removeItem(OK_KEY);
    } catch {
      return;
    }
    if (!queryLooksSuccessful()) {
      return;
    }
    setOk(true);
    const timer = window.setTimeout(() => setOk(false), OK_MS);
    return () => window.clearTimeout(timer);
  }, [successKey]);

  return ok;
}

export function PendingSubmitButton({
  children,
  pendingLabel,
  successKey,
  className = "",
  name,
  value,
  formAction,
}: {
  children: ReactNode;
  pendingLabel?: string;
  successKey?: string;
  className?: string;
  name?: string;
  value?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending, data } = useFormStatus();
  const thisPending =
    pending &&
    (name === undefined ||
      value === undefined ||
      data?.get(name) === value);
  const stretch = /(^|\s)w-full(\s|$)/.test(className);
  const restored = useStoredButtonSuccess(successKey);
  const wasPending = useRef(false);
  const [localOk, setLocalOk] = useState(false);
  const ok = restored || localOk;

  useEffect(() => {
    if (thisPending) {
      wasPending.current = true;
      setLocalOk(false);
      if (successKey) {
        try {
          sessionStorage.setItem(OK_KEY, successKey);
        } catch {
          /* ignore */
        }
      }
      return;
    }
    if (successKey || !wasPending.current) {
      return;
    }
    wasPending.current = false;
    setLocalOk(true);
    const timer = window.setTimeout(() => setLocalOk(false), OK_MS);
    return () => window.clearTimeout(timer);
  }, [thisPending, successKey]);

  return (
    <button
      type="submit"
      name={name}
      value={value}
      formAction={formAction}
      disabled={pending}
      aria-busy={thisPending}
      aria-label={thisPending ? pendingLabel : ok ? "Done" : undefined}
      className={`disabled:opacity-70 ${className}`}
    >
      <span
        className={
          stretch
            ? "grid w-full justify-items-stretch"
            : "inline-grid justify-items-center"
        }
      >
        <span
          className={`invisible col-start-1 row-start-1 whitespace-nowrap ${
            stretch ? "flex w-full items-center justify-between" : ""
          }`}
          aria-hidden
        >
          {children}
        </span>
        <span
          className={
            stretch
              ? `col-start-1 row-start-1 flex w-full items-center ${
                  thisPending || ok ? "justify-center" : "justify-between"
                }`
              : "col-start-1 row-start-1 inline-flex items-center justify-center"
          }
        >
          {thisPending ? (
            <ButtonBusyIcon />
          ) : ok ? (
            <ButtonCheckIcon />
          ) : (
            children
          )}
        </span>
      </span>
    </button>
  );
}
