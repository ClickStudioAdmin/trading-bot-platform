"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { IconCheck, IconLoader } from "@/components/icons";
import { useDeskFormStatus } from "@/components/stay-on-page-form";

const OK_KEY = "tbp-btn-ok";
const OK_MS = 1500;

export function ButtonBusyIcon() {
  return <IconLoader size={12} className="size-3 shrink-0 animate-spin" />;
}

export function ButtonCheckIcon() {
  return <IconCheck size={12} className="size-3 text-success" />;
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
    params.get("saved") === "trader" ||
    params.get("saved") === "password" ||
    params.get("saved") === "share" ||
    params.get("saved") === "invite" ||
    params.get("saved") === "revoke" ||
    params.get("reduce") === "1" ||
    params.get("removed") === "1" ||
    params.get("replaced") === "1" ||
    params.get("renamed") === "1" ||
    paper === "webhook-arm" ||
    paper === "playbook-closed" ||
    paper === "live-playbook-closed" ||
    paper === "position-closed" ||
    paper === "live-position-closed" ||
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
  form,
  disabled = false,
  title,
  skipSizeGuard = false,
  deskAction,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  pendingLabel?: string;
  successKey?: string;
  className?: string;
  name?: string;
  value?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  form?: string;
  disabled?: boolean;
  title?: string;
  skipSizeGuard?: boolean;
  deskAction?: string;
  "aria-label"?: string;
}) {
  const { pending, data } = useFormStatus();
  const desk = useDeskFormStatus();
  const actionKey = deskAction ?? "default";
  const thisPending = desk.active
    ? desk.pending && desk.pendingAction === actionKey
    : pending &&
      (name === undefined ||
        value === undefined ||
        data?.get(name) === value);
  const stretch = /(^|\s)w-full(\s|$)/.test(className);
  const restored = useStoredButtonSuccess(successKey);
  const wasPending = useRef(false);
  const [localOk, setLocalOk] = useState(false);
  const ok = desk.active
    ? desk.ok && desk.okAction === actionKey
    : restored || localOk;

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
      form={form}
      formAction={formAction}
      disabled={(desk.active ? desk.pending : pending) || disabled}
      title={title}
      data-skip-size-guard={skipSizeGuard ? "1" : undefined}
      data-desk-action={deskAction}
      aria-busy={thisPending}
      aria-label={
        thisPending ? pendingLabel : ok ? "Done" : ariaLabel
      }
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
            stretch
              ? "flex w-full items-center justify-center gap-1.5"
              : "inline-flex items-center justify-center gap-1.5"
          }`}
          aria-hidden
        >
          {children}
        </span>
        <span
          className={
            stretch
              ? "col-start-1 row-start-1 flex w-full items-center justify-center gap-1.5"
              : "col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5"
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
