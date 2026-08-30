"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { validateNewDeskName } from "@/lib/accounts/model";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function DeskSettingsForm({
  action,
  defaultName,
  otherNames,
  successKey,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultName: string;
  otherNames: string[];
  successKey: string;
  className: string;
  children: ReactNode;
}) {
  const errorId = useId();
  const [name, setName] = useState(defaultName);
  const nameCheck = validateNewDeskName(name, otherNames);
  const nameError = !nameCheck.ok ? nameCheck.error : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!nameCheck.ok) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={onSubmit} className={className}>
      <label className="block text-sm text-ink">
        Desk name
        <input
          name="name"
          required
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? errorId : undefined}
          className={
            nameError
              ? `${fieldClass} border-danger focus:border-danger`
              : fieldClass
          }
        />
        {nameError ? (
          <p id={errorId} className="mt-1 text-xs text-danger">
            {nameError}
          </p>
        ) : null}
      </label>
      {children}
      <PendingSubmitButton
        pendingLabel="Saving…"
        disabled={!nameCheck.ok}
        successKey={successKey}
        className="rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink"
      >
        Save settings
      </PendingSubmitButton>
    </form>
  );
}
