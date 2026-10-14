"use client";

import { createContext, useContext, type ReactNode } from "react";
import { STEP_UP_FIELD } from "@/lib/auth/step-up";

const TotpStepUpContext = createContext(false);

export function TotpStepUpProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <TotpStepUpContext.Provider value={enabled}>
      {children}
    </TotpStepUpContext.Provider>
  );
}

const fieldClass =
  "mt-1 w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function StepUpCodeField({
  required = true,
  className = "",
  inputClassName = fieldClass,
  hint = "Google Authenticator or a recovery code.",
}: {
  required?: boolean;
  className?: string;
  inputClassName?: string;
  hint?: string;
}) {
  const enabled = useContext(TotpStepUpContext);
  if (!enabled) {
    return null;
  }
  return (
    <label className={`block text-sm text-ink ${className}`.trim()}>
      Authenticator code
      <input
        name={STEP_UP_FIELD}
        required={required}
        autoComplete="one-time-code"
        spellCheck={false}
        className={inputClassName}
      />
      <span className="mt-1 block text-hint text-ink-muted">{hint}</span>
    </label>
  );
}
