"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type FormEvent,
  type FormHTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { useFormStatus } from "react-dom";
import { ButtonBusyIcon } from "@/components/pending-submit-button";
import { Modal } from "@/components/template-modals";
import { STEP_UP_FIELD, stepUpShouldAsk } from "@/lib/auth/step-up";

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

export function useTotpStepUpEnabled(): boolean {
  return useContext(TotpStepUpContext);
}

const fieldClass =
  "mt-1 w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";
const cancelClass =
  "shrink-0 rounded-control px-1.5 py-0.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-40";
const continueClass =
  "rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent disabled:opacity-70";
const dangerClass =
  "rounded-control bg-danger px-4 py-2 text-sm font-medium text-canvas hover:opacity-90 disabled:opacity-70";

export const STEP_UP_MODAL_TITLE = "2FA Authentication Required";

function StepUpFormPending({
  onPending,
}: {
  onPending: (pending: boolean) => void;
}) {
  const { pending } = useFormStatus();
  useEffect(() => {
    onPending(pending);
  }, [onPending, pending]);
  return null;
}

export function StepUpPrompt({
  formId,
  confirmLabel,
  danger = false,
  pending = false,
  error = null,
  onCancel,
  hint = "Google Authenticator or a recovery code.",
}: {
  formId: string;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  error?: string | null;
  onCancel: () => void;
  hint?: string;
}) {
  const fieldId = `${formId}-code`;
  return (
    <>
      <label htmlFor={fieldId} className="mt-4 block text-sm text-ink">
        Authenticator code
        <input
          id={fieldId}
          form={formId}
          name={STEP_UP_FIELD}
          required
          autoFocus
          autoComplete="one-time-code"
          spellCheck={false}
          className={fieldClass}
        />
        <span className="mt-1 block text-hint text-ink-muted">{hint}</span>
      </label>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className={cancelClass}
        >
          Cancel
        </button>
        <button
          type="submit"
          form={formId}
          disabled={pending}
          className={danger ? dangerClass : continueClass}
        >
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <ButtonBusyIcon />
              Checking…
            </span>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </>
  );
}

export function StepUpModal({
  open,
  formId,
  confirmLabel,
  danger = false,
  pending = false,
  error = null,
  onCancel,
}: {
  open: boolean;
  formId: string;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  error?: string | null;
  onCancel: () => void;
}) {
  const close = useCallback(() => {
    if (pending) {
      return;
    }
    onCancel();
  }, [onCancel, pending]);
  if (!open) {
    return null;
  }
  return (
    <Modal title={STEP_UP_MODAL_TITLE} onClose={close} elevated>
      <StepUpPrompt
        formId={formId}
        confirmLabel={confirmLabel}
        danger={danger}
        pending={pending}
        error={error}
        onCancel={close}
      />
    </Modal>
  );
}

export function StepUpForm({
  action,
  className,
  autoComplete,
  children,
  aliasName,
  initialAlias = "",
  confirmLabel = "Continue",
  danger = false,
  error = null,
  pending = false,
  onSubmit,
  onInput,
  onCancel,
  formRef,
}: {
  action?: FormHTMLAttributes<HTMLFormElement>["action"];
  className?: string;
  autoComplete?: string;
  children: ReactNode;
  /** When set, an unchanged value skips the modal. */
  aliasName?: string;
  initialAlias?: string;
  confirmLabel?: string;
  danger?: boolean;
  error?: string | null;
  pending?: boolean;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  onInput?: (event: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
  formRef?: RefObject<HTMLFormElement | null>;
}) {
  const enabled = useTotpStepUpEnabled();
  const formId = `step-up-${useId().replace(/:/g, "")}`;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const busy = pending || submitting;
  const cancel = useCallback(() => {
    setOpen(false);
    onCancel?.();
  }, [onCancel]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const aliasUnchanged = aliasName
      ? String(data.get(aliasName) ?? "") === initialAlias
      : false;
    if (
      stepUpShouldAsk({
        enabled,
        code: String(data.get(STEP_UP_FIELD) ?? ""),
        aliasUnchanged,
      })
    ) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    onSubmit?.(event);
  }

  return (
    <>
      <form
        id={formId}
        ref={formRef}
        action={action}
        className={className}
        autoComplete={autoComplete}
        onSubmit={handleSubmit}
        onInput={onInput}
      >
        <StepUpFormPending onPending={setSubmitting} />
        {children}
      </form>
      <StepUpModal
        open={open && enabled}
        formId={formId}
        confirmLabel={confirmLabel}
        danger={danger}
        pending={busy}
        error={error}
        onCancel={cancel}
      />
    </>
  );
}
