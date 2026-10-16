"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconDisable, IconLoader } from "@/components/icons";
import { TABLE_BTN_ICON, TableIconAction } from "@/components/table-chrome";
import { Modal } from "@/components/template-modals";
import {
  closeDeskPositions,
  disableDeskBots,
} from "@/lib/accounts/disable-desk-actions";
import {
  DISABLE_DESK_SUCCESS,
  disableDeskConfirmBody,
  disableDeskSuccessBody,
  type DeskDisableBotKind,
} from "@/lib/accounts/disable-desk";

type StepState = "waiting" | "running" | "done" | "error";

type Step = {
  state: StepState;
  detail: string;
};

const idleStep: Step = { state: "waiting", detail: "" };

const cancelBtn =
  "rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong";
const dangerBtn =
  "rounded-control bg-danger px-4 py-2 text-sm font-medium text-ink hover:opacity-90";

export function AccountDisableControl({
  accountId,
  accountName,
  kind,
  disabled = false,
}: {
  accountId: string;
  accountName: string;
  kind: DeskDisableBotKind;
  disabled?: boolean;
}) {
  const router = useRouter();
  const started = useRef(false);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"confirm" | "run" | "done" | "error">(
    "confirm",
  );
  const [bots, setBots] = useState<Step>(idleStep);
  const [positions, setPositions] = useState<Step>(idleStep);
  const [success, setSuccess] = useState("");

  function reset() {
    started.current = false;
    setPhase("confirm");
    setBots(idleStep);
    setPositions(idleStep);
    setSuccess("");
  }

  function close() {
    if (phase === "run") {
      return;
    }
    setOpen(false);
  }

  async function start() {
    if (started.current) {
      return;
    }
    started.current = true;
    setPhase("run");
    setBots({ state: "running", detail: "" });
    setPositions(idleStep);
    setSuccess("");
    let stage: "bots" | "positions" = "bots";
    try {
      const disabled = await disableDeskBots(accountId);
      if (!disabled.ok) {
        setBots({ state: "error", detail: disabled.error });
        setPhase("error");
        router.refresh();
        return;
      }
      setBots({ state: "done", detail: disabled.detail });
      stage = "positions";
      setPositions({ state: "running", detail: "" });
      const closed = await closeDeskPositions(accountId);
      if (!closed.ok) {
        setPositions({ state: "error", detail: closed.error });
        setPhase("error");
        router.refresh();
        return;
      }
      setPositions({ state: "done", detail: closed.detail });
      setSuccess(
        disableDeskSuccessBody({
          closed: closed.closed,
          cancelled: closed.cancelled,
        }),
      );
      setPhase("done");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "That did not work.";
      if (stage === "bots") {
        setBots({ state: "error", detail: message });
      } else {
        setPositions({ state: "error", detail: message });
      }
      setPhase("error");
      router.refresh();
    }
  }

  const title =
    phase === "done"
      ? "Desk disabled"
      : phase === "confirm"
        ? "Disable this desk?"
        : "Disabling desk";

  return (
    <>
      <TableIconAction
        label="Disable desk"
        detail={
          disabled
            ? "This desk is already inactive."
            : "Turn every bot off, then close open positions."
        }
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }
          if (open) {
            close();
            return;
          }
          reset();
          setOpen(true);
        }}
      >
        <IconDisable {...TABLE_BTN_ICON} />
      </TableIconAction>
      {open ? (
        <Modal title={title} onClose={close} elevated>
          {phase === "confirm" ? (
            <>
              <p className="mt-2 text-sm text-ink-muted">
                {disableDeskConfirmBody(accountName, kind)}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" className={cancelBtn} onClick={close}>
                  Cancel
                </button>
                <button type="button" className={dangerBtn} onClick={() => void start()}>
                  Disable desk
                </button>
              </div>
            </>
          ) : (
            <>
              <ol className="mt-4 space-y-3" aria-live="polite">
                <StepRow label="Disable all bots" step={bots} />
                <StepRow label="Close all positions" step={positions} />
              </ol>
              {phase === "done" ? (
                <div className="mt-4">
                  <p className="rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                    {DISABLE_DESK_SUCCESS}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">{success}</p>
                </div>
              ) : null}
              {phase === "done" || phase === "error" ? (
                <div className="mt-5 flex justify-end">
                  <button type="button" className={cancelBtn} onClick={close}>
                    Close
                  </button>
                </div>
              ) : null}
            </>
          )}
        </Modal>
      ) : null}
    </>
  );
}

function StepRow({ label, step }: { label: string; step: Step }) {
  return (
    <li className="flex items-start gap-3">
      <StepMark state={step.state} />
      <span className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        {step.detail ? (
          <span
            className={`mt-0.5 block text-hint ${
              step.state === "error" ? "text-danger" : "text-ink-muted"
            }`}
          >
            {step.detail}
          </span>
        ) : null}
      </span>
    </li>
  );
}

function StepMark({ state }: { state: StepState }) {
  if (state === "running") {
    return (
      <IconLoader
        aria-hidden
        className="mt-0.5 size-3.5 shrink-0 animate-spin text-ink-muted"
      />
    );
  }
  if (state === "done") {
    return (
      <IconCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success" />
    );
  }
  return (
    <span
      aria-hidden
      className={`mt-1.5 size-2 shrink-0 rounded-full ${
        state === "error" ? "bg-danger" : "bg-line-strong"
      }`}
    />
  );
}
