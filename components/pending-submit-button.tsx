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
  pendingLabel?: ReactNode;
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

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={thisPending}
      className={`disabled:opacity-70 ${className}`}
    >
      {thisPending ? (
        <span className="inline-flex items-center gap-1.5">
          <ButtonBusyIcon />
          {pendingLabel ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
