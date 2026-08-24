"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function ButtonBusyIcon() {
  return (
    <span
      className="inline-block size-3 shrink-0 animate-spin rounded-full border border-current border-t-transparent"
      aria-hidden
    />
  );
}

export function PendingSubmitButton({
  children,
  pendingLabel,
  className = "",
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
  const thisPending =
    pending &&
    (name === undefined ||
      value === undefined ||
      data?.get(name) === value);
  const stretch = /(^|\s)w-full(\s|$)/.test(className);

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={thisPending}
      aria-label={thisPending ? pendingLabel : undefined}
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
                  thisPending ? "justify-center" : "justify-between"
                }`
              : "col-start-1 row-start-1 inline-flex items-center justify-center"
          }
        >
          {thisPending ? <ButtonBusyIcon /> : children}
        </span>
      </span>
    </button>
  );
}
