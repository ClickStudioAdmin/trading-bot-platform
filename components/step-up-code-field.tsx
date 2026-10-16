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
import { SecondFactorEntry } from "@/components/totp-code-boxes";
import {
  secondFactorMissingMessage,
  STEP_UP_FIELD,
  stepUpRejectionMessage,
  stepUpShouldAsk,
} from "@/lib/auth/step-up";

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
  initialRecovery = false,
}: {
  formId: string;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  error?: string | null;
  onCancel: () => void;
  initialRecovery?: boolean;
}) {
  const fieldId = `${formId}-code`;
  const [missing, setMissing] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(initialRecovery);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  if (!error && dismissedError) {
    setDismissedError(null);
  }
  const serverError = error && error === dismissedError ? null : error;
  const shownError =
    serverError ?? (missing ? secondFactorMissingMessage(recoveryMode) : null);
  return (
    <>
      <div className="mt-4">
        <SecondFactorEntry
          id={fieldId}
          name={STEP_UP_FIELD}
          form={formId}
          disabled={pending}
          allowRecovery
          initialRecovery={initialRecovery}
          onValueChange={(value) => {
            if (value.trim()) {
              setMissing(false);
            }
          }}
          onRecoveryModeChange={(recovery) => {
            setRecoveryMode(recovery);
            setMissing(false);
            setDismissedError(error);
          }}
        />
      </div>
      {shownError ? <p className="mt-3 text-sm text-danger">{shownError}</p> : null}
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
          onClick={(event) => {
            const formEl = document.getElementById(formId);
            if (!(formEl instanceof HTMLFormElement)) {
              return;
            }
            const code = String(new FormData(formEl).get(STEP_UP_FIELD) ?? "");
            if (code.trim()) {
              return;
            }
            event.preventDefault();
            setMissing(true);
          }}
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
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const busy = pending || submitting;
  const cancel = useCallback(() => {
    setOpen(false);
    setStepUpError(null);
    onCancel?.();
  }, [onCancel]);

  async function runAction(formData: FormData) {
    if (typeof action !== "function") {
      return;
    }
    setStepUpError(null);
    const result = await action(formData);
    const message = stepUpRejectionMessage(result);
    if (!message) {
      return;
    }
    setStepUpError(message);
    setOpen(true);
  }

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
      setStepUpError(null);
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
        action={typeof action === "function" ? runAction : action}
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
        error={stepUpError ?? error}
        onCancel={cancel}
      />
    </>
  );
}
