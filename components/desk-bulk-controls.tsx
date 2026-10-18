"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSelect } from "@/components/app-select";
import { IconCheck, IconDisable, IconLoader, IconTrash } from "@/components/icons";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { StepUpForm } from "@/components/step-up-code-field";
import { TABLE_BTN_ICON, TableLabelButton } from "@/components/table-chrome";
import { Modal } from "@/components/template-modals";
import { deleteTradingAccountForBulk } from "@/lib/accounts/actions";
import {
  bulkDeleteConfirmBody,
  bulkDeleteOrder,
  bulkDeleteSuccess,
  bulkDeskDeleteBlockReason,
  bulkDisableBlockReason,
  bulkDisableConfirmBody,
  bulkDisableSuccess,
  bulkDisableSuccessDetail,
  deskBulkName,
  pickBulkDeleteSwitch,
  type DeskBulkTarget,
} from "@/lib/accounts/desk-bulk";
import {
  DESK_DELETE_MISSING,
  DESK_DELETE_PASS_DEADLINE_MS,
  DESK_DELETE_TIMED_OUT,
  continueTimedDeskDelete,
  deskDeleteAttemptTimeout,
  withDeskDeleteDeadline,
} from "@/lib/accounts/desk-delete";
import { deskDisableBotKind } from "@/lib/accounts/disable-desk";
import {
  closeDeskPositions,
  disableDeskBots,
} from "@/lib/accounts/disable-desk-actions";
import type { DeskListRow } from "@/lib/accounts/desk-list";
import {
  formatAccountMode,
  type TradingAccount,
} from "@/lib/accounts/model";
import {
  rethrowNextControlFlow,
  stepUpRejectionMessage,
} from "@/lib/auth/step-up";

const cancelBtn =
  "rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong disabled:opacity-40";
const dangerBtn =
  "rounded-control bg-danger px-4 py-2 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-40";

type StepState = "waiting" | "running" | "done" | "error";

type Step = {
  state: StepState;
  detail: string;
};

const idleStep: Step = { state: "waiting", detail: "" };

function toTarget(row: DeskListRow): DeskBulkTarget {
  return {
    id: row.account.id,
    name: row.account.name,
    status: row.status,
    blocks: row.blocks,
    closeKind: row.closeKind,
  };
}

export function DeskBulkToolbar({
  rows,
  ownedCount,
  pending = false,
  onDisable,
  onDelete,
}: {
  rows: DeskListRow[];
  ownedCount: number;
  pending?: boolean;
  onDisable: () => void;
  onDelete: () => void;
}) {
  const targets = rows.map(toTarget);
  const disableReason = bulkDisableBlockReason(targets);
  const deleteReason = bulkDeskDeleteBlockReason(targets, ownedCount);
  return (
    <>
      <p className="text-sm text-ink-muted">{rows.length} selected</p>
      <span title={disableReason ?? undefined} className="inline-flex">
        <TableLabelButton
          variant="bulk"
          icon={<IconDisable {...TABLE_BTN_ICON} />}
          className={disableReason ? "pointer-events-none" : ""}
          disabled={pending || Boolean(disableReason)}
          onClick={onDisable}
        >
          Disable
        </TableLabelButton>
      </span>
      <span title={deleteReason ?? undefined} className="inline-flex">
        <TableLabelButton
          variant="danger"
          icon={<IconTrash {...TABLE_BTN_ICON} />}
          className={deleteReason ? "pointer-events-none" : ""}
          disabled={pending || Boolean(deleteReason)}
          onClick={onDelete}
        >
          Delete
        </TableLabelButton>
      </span>
    </>
  );
}

export function DeskBulkDisableDialog({
  rows,
  onClose,
  onFinished,
}: {
  rows: DeskListRow[];
  onClose: () => void;
  onFinished: (ids: string[]) => void;
}) {
  const router = useRouter();
  const started = useRef(false);
  const [targets] = useState(rows);
  const [phase, setPhase] = useState<"confirm" | "run" | "done" | "error">(
    "confirm",
  );
  const [runs, setRuns] = useState<
    { id: string; name: string; bots: Step; positions: Step }[]
  >(() =>
    rows.map((row) => ({
      id: row.account.id,
      name: deskBulkName(row.account.name),
      bots: idleStep,
      positions: idleStep,
    })),
  );
  const [successDetail, setSuccessDetail] = useState<string | null>(null);
  const kinds = targets.map((row) => ({
    name: row.account.name,
    kind: deskDisableBotKind(row.account),
  }));

  function close() {
    if (phase === "run") {
      return;
    }
    onClose();
  }

  function patch(id: string, which: "bots" | "positions", step: Step) {
    setRuns((current) =>
      current.map((row) => (row.id === id ? { ...row, [which]: step } : row)),
    );
  }

  async function start() {
    if (started.current) {
      return;
    }
    started.current = true;
    setPhase("run");
    const finished: string[] = [];
    let closed = 0;
    let cancelled = 0;
    for (const row of targets) {
      const id = row.account.id;
      patch(id, "bots", { state: "running", detail: "" });
      let stage: "bots" | "positions" = "bots";
      try {
        const disabled = await disableDeskBots(id);
        if (!disabled.ok) {
          patch(id, "bots", { state: "error", detail: disabled.error });
          setPhase("error");
          onFinished(finished);
          router.refresh();
          return;
        }
        patch(id, "bots", { state: "done", detail: disabled.detail });
        stage = "positions";
        patch(id, "positions", { state: "running", detail: "" });
        const positions = await closeDeskPositions(id);
        if (!positions.ok) {
          patch(id, "positions", { state: "error", detail: positions.error });
          setPhase("error");
          onFinished(finished);
          router.refresh();
          return;
        }
        patch(id, "positions", { state: "done", detail: positions.detail });
        closed += positions.closed;
        cancelled += positions.cancelled;
        finished.push(id);
      } catch (error) {
        rethrowNextControlFlow(error);
        const message =
          error instanceof Error && error.message
            ? error.message
            : "That did not work.";
        patch(id, stage, { state: "error", detail: message });
        setPhase("error");
        onFinished(finished);
        router.refresh();
        return;
      }
    }
    setSuccessDetail(
      bulkDisableSuccessDetail({
        count: targets.length,
        closed,
        cancelled,
      }),
    );
    setPhase("done");
    onFinished(finished);
    router.refresh();
  }

  const title =
    phase === "done"
      ? targets.length === 1
        ? "Desk disabled"
        : "Desks disabled"
      : phase === "confirm"
        ? targets.length === 1
          ? "Disable this desk?"
          : "Disable these desks?"
        : targets.length === 1
          ? "Disabling desk"
          : "Disabling desks";

  return (
    <Modal title={title} onClose={close} elevated>
      {phase === "confirm" ? (
        <>
          <p className="mt-2 text-sm text-ink-muted">
            {bulkDisableConfirmBody(kinds)}
          </p>
          <DeskNameList
            names={targets.map((row) => deskBulkName(row.account.name))}
          />
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className={cancelBtn} onClick={close}>
              Cancel
            </button>
            <button type="button" className={dangerBtn} onClick={() => void start()}>
              {targets.length === 1 ? "Disable desk" : "Disable desks"}
            </button>
          </div>
        </>
      ) : (
        <>
          <ol className="mt-4 max-h-80 space-y-4 overflow-y-auto" aria-live="polite">
            {runs.map((run) => (
              <li key={run.id}>
                <p className="text-sm font-medium text-ink">{run.name}</p>
                <ol className="mt-2 space-y-3">
                  <StepRow label="Disable all bots" step={run.bots} />
                  <StepRow label="Close all positions" step={run.positions} />
                </ol>
              </li>
            ))}
          </ol>
          {phase === "done" ? (
            <div className="mt-4">
              <p className="rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                {bulkDisableSuccess(targets.length)}
              </p>
              {successDetail ? (
                <p className="mt-1 text-sm text-ink-muted">{successDetail}</p>
              ) : null}
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
  );
}

export function DeskBulkDeleteDialog({
  rows,
  accounts,
  currentId,
  onClose,
  onFinished,
  onDeleted,
}: {
  rows: DeskListRow[];
  accounts: TradingAccount[];
  currentId: string;
  onClose: () => void;
  onFinished: (ids: string[]) => void;
  onDeleted: (message: string) => void;
}) {
  const router = useRouter();
  const running = useRef(false);
  const [targets] = useState(rows);
  const ids = bulkDeleteOrder(
    targets.map((row) => row.account.id),
    currentId,
  );
  const names = ids.map((id) => {
    const row = targets.find((item) => item.account.id === id);
    return deskBulkName(row?.account.name ?? "");
  });
  const survivors = accounts.filter((account) => !ids.includes(account.id));
  const switching = ids.includes(currentId) && survivors.length > 0;
  const defaultSwitch = pickBulkDeleteSwitch(accounts, ids, undefined);

  function close() {
    if (running.current) {
      return;
    }
    onClose();
  }

  async function run(formData: FormData) {
    running.current = true;
    let grant = "";
    let deleted = 0;
    try {
      for (let index = 0; index < ids.length; index += 1) {
        const id = ids[index] ?? "";
        formData.set("accountId", id);
        formData.delete("bulkLast");
        if (index === ids.length - 1) {
          formData.set("bulkLast", "1");
        }
        let sawTimeout = false;
        const result = await continueTimedDeskDelete(async () => {
          if (grant) {
            formData.set("deskDeleteGrant", grant);
          }
          let value: { stepUpError?: string; deskDeleteGrant?: string };
          try {
            value = await withDeskDeleteDeadline(
              () => deleteTradingAccountForBulk(formData),
              deskDeleteAttemptTimeout(grant),
              DESK_DELETE_PASS_DEADLINE_MS,
            );
          } catch (error) {
            rethrowNextControlFlow(error);
            const message =
              error instanceof Error && error.message
                ? error.message
                : "That did not work.";
            return { stepUpError: message, deskDeleteGrant: grant || undefined };
          }
          if (value.deskDeleteGrant) {
            grant = value.deskDeleteGrant;
          }
          if (stepUpRejectionMessage(value) === DESK_DELETE_TIMED_OUT) {
            sawTimeout = true;
          }
          return value;
        }, (value) => stepUpRejectionMessage(value) === DESK_DELETE_TIMED_OUT);
        const message = stepUpRejectionMessage(result);
        if (message === DESK_DELETE_MISSING && sawTimeout) {
          deleted += 1;
          continue;
        }
        if (message) {
          onFinished(ids.slice(0, deleted));
          router.refresh();
          const lead = deleted > 0 ? `${bulkDeleteSuccess(deleted)} ` : "";
          return { stepUpError: `${lead}${message}` };
        }
        deleted += 1;
      }
      onFinished(ids);
      onDeleted(bulkDeleteSuccess(deleted));
      router.refresh();
    } finally {
      running.current = false;
    }
  }

  return (
    <Modal
      title={ids.length === 1 ? "Delete this desk?" : "Delete these desks?"}
      onClose={close}
    >
      <StepUpForm
        action={run}
        confirmLabel={ids.length === 1 ? "Delete desk" : "Delete desks"}
        danger
        pendingLabel="Deleting…"
        className="flex flex-col gap-3"
      >
        <p className="min-w-0 break-words text-sm font-medium text-ink">
          {bulkDeleteConfirmBody(names)}
        </p>
        <DeskNameList names={names} />
        <p className="text-hint text-ink-muted">This cannot be undone.</p>
        {ids.map((id) => (
          <input key={id} type="hidden" name="bulkAccountId" value={id} />
        ))}
        {switching ? (
          <SwitchFields
            options={survivors.map((account) => ({
              id: account.id,
              name: account.name,
              mode: formatAccountMode(account.mode),
            }))}
            defaultSwitchId={defaultSwitch?.id}
          />
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" className={cancelBtn} onClick={close}>
            Cancel
          </button>
          <PendingSubmitButton
            pendingLabel="Deleting…"
            className={dangerBtn}
          >
            {ids.length === 1 ? "Delete desk" : "Delete desks"}
          </PendingSubmitButton>
        </div>
      </StepUpForm>
    </Modal>
  );
}

function DeskNameList({ names }: { names: string[] }) {
  if (names.length < 2) {
    return null;
  }
  return (
    <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-ink">
      {names.map((name, index) => (
        <li key={`${name}-${index}`}>{name}</li>
      ))}
    </ul>
  );
}

function SwitchFields({
  options,
  defaultSwitchId,
}: {
  options: { id: string; name: string; mode: string }[];
  defaultSwitchId?: string;
}) {
  if (options.length === 0) {
    return null;
  }
  if (options.length === 1) {
    const only = options[0];
    return (
      <>
        <input type="hidden" name="switchToAccountId" value={only?.id ?? ""} />
        <p className="text-hint text-ink-muted">Switch to {only?.name}.</p>
      </>
    );
  }
  return (
    <label className="block text-sm text-ink">
      Switch to
      <AppSelect
        name="switchToAccountId"
        defaultValue={defaultSwitchId ?? options[0]?.id}
        className="mt-1 w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name} ({option.mode})
          </option>
        ))}
      </AppSelect>
    </label>
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
