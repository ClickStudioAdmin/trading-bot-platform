"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  TOTP_DIGIT_COUNT,
  clampTotpCode,
  totpDigitsComplete,
} from "@/lib/auth/totp-digits";
import {
  AUTHENTICATOR_CODE_HINT,
  AUTHENTICATOR_CODE_LABEL,
  RECOVERY_CODE_HINT,
  RECOVERY_CODE_LABEL,
  STEP_UP_KIND_FIELD,
  USE_AUTHENTICATOR_CODE,
  USE_RECOVERY_CODE,
} from "@/lib/auth/step-up";

const boxClass =
  "flex aspect-square w-full min-w-0 items-center justify-center rounded-control border bg-canvas p-0 text-2xl font-medium tabular-nums leading-none text-ink";
const recoveryClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none disabled:opacity-60";

export function TotpCodeBoxes({
  id,
  name,
  form,
  autoFocus = true,
  disabled = false,
  allowRecovery = false,
  initialRecovery = false,
  onValueChange,
  onRecoveryModeChange,
  children,
}: {
  id: string;
  name: string;
  form?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  allowRecovery?: boolean;
  initialRecovery?: boolean;
  onValueChange?: (value: string) => void;
  onRecoveryModeChange?: (recovery: boolean) => void;
  children?: ReactNode;
}) {
  const { pending } = useFormStatus();
  const locked = disabled || pending;
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(initialRecovery);
  const [recoveryValue, setRecoveryValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const submittedCode = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeIndex = Math.min(code.length, TOTP_DIGIT_COUNT - 1);
  const external = Boolean(form);
  const submittedValue = recoveryMode ? recoveryValue : code;

  function publish(next: string) {
    onValueChange?.(next);
  }

  useEffect(() => {
    if (recoveryMode || locked || !totpDigitsComplete(code)) {
      if (!totpDigitsComplete(code)) {
        submittedCode.current = null;
      }
      return;
    }
    if (submittedCode.current === code) {
      return;
    }
    const formEl = form
      ? document.getElementById(form)
      : rootRef.current?.closest("form");
    if (!(formEl instanceof HTMLFormElement)) {
      return;
    }
    if (!formEl.checkValidity()) {
      formEl.reportValidity();
      return;
    }
    submittedCode.current = code;
    formEl.requestSubmit();
  }, [code, form, locked, recoveryMode]);

  function toggleRecovery() {
    submittedCode.current = null;
    const next = !recoveryMode;
    if (recoveryMode) {
      setRecoveryValue("");
    } else {
      setCode("");
    }
    setRecoveryMode(next);
    onRecoveryModeChange?.(next);
    publish("");
  }

  return (
    <div ref={rootRef}>
      {external ? (
        <input
          type="hidden"
          name={name}
          form={form}
          value={submittedValue}
          readOnly
        />
      ) : null}
      {allowRecovery ? (
        <input
          type="hidden"
          name={STEP_UP_KIND_FIELD}
          form={form}
          value={recoveryMode ? "recovery" : "authenticator"}
          readOnly
        />
      ) : null}
      {recoveryMode ? (
        <input
          id={id}
          name={external ? undefined : name}
          form={form}
          value={recoveryValue}
          required
          autoFocus={autoFocus}
          autoComplete="one-time-code"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={locked}
          placeholder="xxxx-xxxx"
          aria-label={RECOVERY_CODE_LABEL}
          className={recoveryClass}
          onChange={(event) => {
            const next = event.target.value;
            setRecoveryValue(next);
            publish(next);
          }}
        />
      ) : (
        <div className="relative mt-1 grid w-full max-w-lg grid-cols-6 gap-2">
          {Array.from({ length: TOTP_DIGIT_COUNT }, (_, index) => (
            <div
              key={index}
              data-totp-box=""
              aria-hidden
              className={`${boxClass} ${
                focused && index === activeIndex
                  ? "border-accent"
                  : "border-line-strong"
              }`}
            >
              {code[index] ?? ""}
            </div>
          ))}
          <input
            ref={inputRef}
            id={id}
            name={external ? undefined : name}
            value={code}
            required={!external}
            autoFocus={autoFocus}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={locked}
            aria-label={AUTHENTICATOR_CODE_LABEL}
            className="absolute inset-0 size-full cursor-text opacity-0"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(event) => {
              const next = clampTotpCode(event.target.value);
              setCode(next);
              publish(next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
              }
            }}
          />
        </div>
      )}
      {children}
      {allowRecovery ? (
        <button
          type="button"
          className="mt-2 block text-hint text-ink-muted hover:text-ink"
          onClick={toggleRecovery}
          disabled={locked}
        >
          {recoveryMode ? USE_AUTHENTICATOR_CODE : USE_RECOVERY_CODE}
        </button>
      ) : null}
    </div>
  );
}

export function SecondFactorEntry({
  id,
  name,
  form,
  autoFocus = true,
  disabled = false,
  allowRecovery = false,
  initialRecovery = false,
  onValueChange,
  onRecoveryModeChange,
}: {
  id: string;
  name: string;
  form?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  allowRecovery?: boolean;
  initialRecovery?: boolean;
  onValueChange?: (value: string) => void;
  onRecoveryModeChange?: (recovery: boolean) => void;
}) {
  const [recoveryMode, setRecoveryMode] = useState(initialRecovery);
  return (
    <>
      <label htmlFor={id} className="block text-sm text-ink">
        {recoveryMode ? RECOVERY_CODE_LABEL : AUTHENTICATOR_CODE_LABEL}
      </label>
      <TotpCodeBoxes
        id={id}
        name={name}
        form={form}
        autoFocus={autoFocus}
        disabled={disabled}
        allowRecovery={allowRecovery}
        initialRecovery={initialRecovery}
        onValueChange={onValueChange}
        onRecoveryModeChange={(recovery) => {
          setRecoveryMode(recovery);
          onRecoveryModeChange?.(recovery);
        }}
      >
        {allowRecovery ? (
          <span className="mt-1 block text-hint text-ink-muted">
            {recoveryMode ? RECOVERY_CODE_HINT : AUTHENTICATOR_CODE_HINT}
          </span>
        ) : null}
      </TotpCodeBoxes>
    </>
  );
}
