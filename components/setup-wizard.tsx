"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirmDialog } from "@/components/confirm-modal";
import { ModalHost } from "@/components/portal-host";
import {
  formatAccountModeChoice,
  formatDeskType,
  formatDeskTypeChoice,
  type DeskType,
} from "@/lib/accounts/model";
import { AppCheck } from "@/components/app-check";
import { AppSelect } from "@/components/app-select";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconClose,
  IconPencil,
  IconPlay,
  IconPlus,
  IconReset,
  IconSave,
  IconSkipForward,
  IconTour,
  IconTrash,
} from "@/components/icons";
import { TemplateNameWithParameters } from "@/components/template-parameters-tip";
import {
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TableActions,
  TableIconAction,
  TableLabelButton,
} from "@/components/table-chrome";
import { checkExchangeConnection } from "@/lib/exchanges/actions";
import { getVenue } from "@/lib/exchanges/venues";
import {
  createSetupBeforeTour,
  finishSetup,
  resetSetupWizard,
  saveSetupConnection,
  saveSetupDraft,
} from "@/lib/onboarding/actions";
import {
  ONBOARDING_DESK_TYPES,
  allocateSetupName,
  connectedSetupName,
  connectedVenuesFor,
  defaultEnvironmentId,
  defaultSetupName,
  SETUP_MAIN_STEPS,
  activeSetupScreen,
  applyBotSetupChoice,
  applyDeskSetupChoice,
  botsEmptyNote,
  readyDeskRows,
  foldersForDesk,
  keptArmTemplateIds,
  makeSetupDesk,
  paperVenuesFor,
  setupDeskDetails,
  setupDeskFromDetails,
  setupScreenId,
  setupDeskCanStartBots,
  setupReviewRows,
  setupScreens,
  starterStartedWord,
  starterStartVerb,
  setupStepLabel,
  starterBotDesks,
  validateSetupNames,
  type BotSetupChoice,
  type DeskSetupChoice,
  type SetupDraft,
  type SetupIssue,
  type SetupScreen,
  type SetupConnection,
  type SetupDesk,
  type StarterFolder,
} from "@/lib/onboarding/model";

const WIZARD_ICON = { size: 14 as const, className: "size-3.5 shrink-0" };

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

function isActionRedirect(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  if (
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  ) {
    return true;
  }
  return error instanceof Error && error.message === "NEXT_REDIRECT";
}

function wizardActionError(error: unknown): string {
  const message =
    error instanceof Error ? error.message.replace(/\s+/g, " ").trim() : "";
  return (message || "Could not finish setup.").slice(0, 180);
}

function SetupProgress({
  screen,
}: {
  screen: Exclude<SetupScreen, { main: "intro" }>;
}) {
  const currentIndex = SETUP_MAIN_STEPS.indexOf(screen.main);
  return (
    <ol aria-label="Setup steps" className="mt-4 flex w-full items-center">
        {SETUP_MAIN_STEPS.map((item, index) => {
          const state =
            index < currentIndex
              ? "done"
              : index === currentIndex
                ? "current"
                : "upcoming";
          const last = index === SETUP_MAIN_STEPS.length - 1;
          return (
            <li
              key={item}
              className={
                last
                  ? "flex min-w-0 items-center"
                  : "flex min-w-0 flex-1 items-center"
              }
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className={
                    state === "current"
                      ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-strong text-sm font-medium text-ink"
                      : state === "done"
                        ? "flex size-7 shrink-0 items-center justify-center rounded-full border border-accent text-sm font-medium text-accent"
                        : "flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-sm font-medium text-ink-faint"
                  }
                >
                  {index + 1}
                </span>
                <span
                  className={
                    state === "current"
                      ? "truncate text-sm font-medium text-ink"
                      : state === "done"
                        ? "truncate text-sm text-ink-muted"
                        : "truncate text-sm text-ink-faint"
                  }
                >
                  {setupStepLabel(item)}
                </span>
              </span>
              {last ? null : (
                <span
                  aria-hidden
                  className={
                    index < currentIndex
                      ? "mx-4 h-px min-w-6 flex-1 bg-accent"
                      : "mx-4 h-px min-w-6 flex-1 bg-line"
                  }
                />
              )}
            </li>
          );
        })}
    </ol>
  );
}

type BindChoice = "later" | "new";

export function SetupWizard({
  initialDraft,
  existingNames,
  folders,
}: {
  initialDraft: SetupDraft;
  existingNames: string[];
  folders: StarterFolder[];
}) {
  const router = useRouter();
  const [desks, setDesks] = useState<SetupDesk[]>(initialDraft.desks);
  const [deskChoice, setDeskChoice] = useState<DeskSetupChoice | null>(
    initialDraft.deskChoice,
  );
  const [botChoice, setBotChoice] = useState<BotSetupChoice | null>(
    initialDraft.botChoice,
  );
  const [applied, setApplied] = useState<string[]>(initialDraft.applied);
  const [summary, setSummary] = useState(initialDraft.summary);
  const [readyForTour, setReadyForTour] = useState(initialDraft.readyForTour);
  const [introSeen, setIntroSeen] = useState(initialDraft.introSeen);
  const [playing, setPlaying] = useState(false);
  const [deskEditor, setDeskEditor] = useState<{
    deskType: DeskType;
    desk: SetupDesk | null;
  } | null>(null);
  const [screenId, setScreenId] = useState(
    initialDraft.readyForTour
      ? "tour:tour"
      : initialDraft.introSeen
        ? "desks:choice"
        : "intro:video",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [resetting, setResetting] = useState(false);
  const { confirm, dialog } = useConfirmDialog();
  const screens = useMemo(
    () => setupScreens({ desks, folders, deskChoice, botChoice }),
    [botChoice, deskChoice, desks, folders],
  );
  const screen = activeSetupScreen(screens, screenId);
  const screenIndex = screens.findIndex(
    (item) => setupScreenId(item) === setupScreenId(screen),
  );
  const previous = screenIndex > 0 ? screens[screenIndex - 1] : null;
  const next =
    screenIndex >= 0 && screenIndex < screens.length - 1
      ? screens[screenIndex + 1]
      : null;
  function draft(overrides?: Partial<SetupDraft>): SetupDraft {
    return {
      desks,
      deskChoice,
      botChoice,
      tourChoice: null,
      applied,
      summary,
      readyForTour,
      introSeen,
      ...overrides,
    };
  }

  function enterSetup() {
    const snapshot = draft({ introSeen: true });
    setError(null);
    startTransition(async () => {
      try {
        const saved = await saveSetupDraft(JSON.stringify(snapshot));
        if (!saved.ok) {
          setError(saved.error);
          return;
        }
        setIntroSeen(true);
        setScreenId("desks:choice");
      } catch (error) {
        setError(wizardActionError(error));
      }
    });
  }

  function takenNames(exceptKey?: string) {
    return [
      ...existingNames,
      ...desks.filter((desk) => desk.key !== exceptKey).map((desk) => desk.name),
    ];
  }

  function updateDesk(key: string, patch: Partial<SetupDesk>) {
    setDesks((current) =>
      current.map((desk) => (desk.key === key ? { ...desk, ...patch } : desk)),
    );
  }

  function upsertDesk(desk: SetupDesk, previousKey: string | null) {
    setDesks((current) => [
      ...current.filter((row) => row.key !== previousKey && row.key !== desk.key),
      desk,
    ]);
  }

  function removeDesk(key: string) {
    setDesks((current) => current.filter((row) => row.key !== key));
  }

  function persist(target: SetupScreen, snapshot?: SetupDraft) {
    const body = snapshot ?? draft();
    const names = validateSetupNames(body.desks, existingNames);
    if (!names.ok) {
      setError(names.error);
      return;
    }
    if (screen.main === "desks" && screen.sub === "exchanges") {
      const missing = body.desks.find(
        (desk) => desk.mode === "live" && !desk.bindLater && !desk.connectionId,
      );
      if (missing) {
        setError(`Choose a key for ${missing.name}, or bind it later.`);
        return;
      }
    }
    setError(null);
    startTransition(async () => {
      try {
        const saved = await saveSetupDraft(JSON.stringify(body));
        if (!saved.ok) {
          setError(saved.error);
          return;
        }
        setScreenId(setupScreenId(target));
      } catch (error) {
        setError(wizardActionError(error));
      }
    });
  }

  function openTour(snapshot?: SetupDraft) {
    const body = snapshot ?? draft();
    const names = validateSetupNames(body.desks, existingNames);
    if (!names.ok) {
      setError(names.error);
      return;
    }
    const missing = body.desks.find(
      (desk) => desk.mode === "live" && !desk.bindLater && !desk.connectionId,
    );
    if (missing) {
      setError(`Choose a key for ${missing.name}, or bind it later.`);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const created = await createSetupBeforeTour(JSON.stringify(body));
        if (!created.ok) {
          setError(created.error);
          return;
        }
        setDesks(created.draft.desks);
        setApplied(created.draft.applied);
        setSummary(created.draft.summary);
        setReadyForTour(true);
        setScreenId("tour:tour");
      } catch (error) {
        setError(wizardActionError(error));
      }
    });
  }

  function advance(target: SetupScreen, snapshot?: SetupDraft) {
    if (target.main === "tour") {
      openTour(snapshot);
      return;
    }
    persist(target, snapshot);
  }

  function continueForward() {
    if (screen.main === "desks" && screen.sub === "choice") {
      if (!deskChoice) {
        setError("Choose how to add desks.");
        return;
      }
      const nextDesks = applyDeskSetupChoice({
        choice: deskChoice,
        desks,
        takenNames: existingNames,
      });
      const nextBotChoice = deskChoice === "none" ? null : botChoice;
      const planned = setupScreens({
        desks: nextDesks,
        folders,
        deskChoice,
        botChoice: nextBotChoice,
      });
      const target = planned.find(
        (item) => item.main !== "intro" && setupScreenId(item) !== "desks:choice",
      );
      if (!target) {
        return;
      }
      setDesks(nextDesks);
      setBotChoice(nextBotChoice);
      advance(
        target,
        draft({
          desks: nextDesks,
          deskChoice,
          botChoice: nextBotChoice,
        }),
      );
      return;
    }
    if (screen.main === "bots" && screen.sub === "choice") {
      if (!botChoice) {
        setError("Choose how to add bots.");
        return;
      }
      const nextDesks = applyBotSetupChoice({
        choice: botChoice,
        desks,
        folders,
      });
      const planned = setupScreens({
        desks: nextDesks,
        folders,
        deskChoice,
        botChoice,
      });
      const index = planned.findIndex(
        (item) => setupScreenId(item) === "bots:choice",
      );
      const target = planned[index + 1];
      if (!target) {
        return;
      }
      setDesks(nextDesks);
      advance(target, draft({ desks: nextDesks, botChoice }));
      return;
    }
    if (next) {
      advance(next);
    }
  }

  function restartWizard() {
    void confirm({
      title: "Reset wizard",
      message:
        "This clears your choices and starts the wizard from the beginning. Desks, bots, and keys created in this setup are removed.",
      confirmLabel: "Reset Wizard",
      danger: true,
    }).then((ok) => {
      if (!ok) {
        return;
      }
      setError(null);
      setResetting(true);
      startTransition(async () => {
        try {
          const result = await resetSetupWizard();
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setDesks([]);
          setDeskChoice(null);
          setBotChoice(null);
          setApplied([]);
          setReadyForTour(false);
          setIntroSeen(false);
          setPlaying(false);
          setDeskEditor(null);
          setScreenId("intro:video");
        } finally {
          setResetting(false);
        }
      });
    });
  }

  function finish(tourChoice: "yes" | "not_now") {
    const names = validateSetupNames(desks, existingNames);
    if (!names.ok) {
      setError(names.error);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await finishSetup(
          JSON.stringify({ ...draft(), tourChoice }),
        );
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
      } catch (error) {
        if (isActionRedirect(error)) {
          router.refresh();
          return;
        }
        setError(wizardActionError(error));
      }
    });
  }

  return (
    <>
    <div
      className="flex min-h-0 flex-1 flex-col"
      inert={deskEditor ? true : undefined}
    >
      <div className="shrink-0 border-b border-line bg-surface-raised px-6 py-4">
        {screen.main === "intro" ? (
          <>
            <h2
              id="setup-gate-title"
              className="text-lg font-semibold tracking-tight"
            >
              Watch a short overview
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Watch the video, or skip it and go straight to setup.
            </p>
          </>
        ) : (
          <>
            <h2
              id="setup-gate-title"
              className="text-lg font-semibold tracking-tight"
            >
              Set up your account
            </h2>
            <SetupProgress screen={screen} />
          </>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
      {screen.main === "intro" ? (
        <IntroStep playing={playing} onWatch={() => setPlaying(true)} />
      ) : null}
      {screen.main === "desks" && screen.sub === "choice" ? (
        <ChoiceStep
          title="Add desks now?"
          intro="You can change this with Back until you click Create. Desks and bots are created then, so the tour can show them."
          name="desk-setup-choice"
          value={deskChoice}
          options={[
            {
              value: "all_paper",
              title: "Create a Paper Trading desk for each strategy type",
              detail: "Quickest way to see all desk types in action.",
            },
            {
              value: "manual",
              title: "Manually select desk types and modes",
              detail: "Create each desk, then review the details before you continue.",
            },
            {
              value: "none",
              title: "Don't add any desks, I'll do it later",
              detail: "You can add them later from Manage desks.",
            },
          ]}
          onChange={(value) => {
            setError(null);
            setDeskChoice(value as DeskSetupChoice);
          }}
        />
      ) : null}
      {screen.main === "desks" && screen.sub === "desks" ? (
        <DeskStep
          desks={desks}
          existingNames={existingNames}
          onCreate={(deskType) => setDeskEditor({ deskType, desk: null })}
          onEdit={(desk) => setDeskEditor({ deskType: desk.deskType, desk })}
          onRemove={removeDesk}
        />
      ) : null}
      {screen.main === "desks" && screen.sub === "exchanges" ? (
        <ExchangeStep
          desks={desks.filter((desk) => desk.mode === "live")}
          onChange={updateDesk}
          takenNames={takenNames}
        />
      ) : null}
      {screen.main === "bots" && screen.sub === "blocked" ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            Load starter bots?
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            You can&apos;t add bots without desks. Go back to add desks, or
            continue to Review. Nothing is created until you click Create.
          </p>
        </section>
      ) : null}
      {screen.main === "bots" && screen.sub === "choice" ? (
        <ChoiceStep
          title="Load starter bots?"
          intro="Tick Initial Status on a bot to start it. Desks and bots are created when you click Create, so the tour can show them."
          note={
            starterBotDesks(desks, folders).length === 0
              ? botsEmptyNote(desks)
              : null
          }
          name="bot-setup-choice"
          value={botChoice}
          options={[
            {
              value: "all",
              title: "Load starter bots onto each desk",
              detail: "Quickest way to see the starter bots in action.",
            },
            {
              value: "manual",
              title: "Manually select starter bots",
              detail:
                "Pick the folders and bots for every desk together, and which of those bots to start.",
            },
            {
              value: "none",
              title: "Don't add any bots, I'll do it later",
              detail: "You can add bots on the desk after setup.",
            },
          ]}
          onChange={(value) => {
            setError(null);
            setBotChoice(value as BotSetupChoice);
          }}
        />
      ) : null}
      {screen.main === "bots" && screen.sub === "empty" ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            Load starter bots?
          </h2>
          <p className="mt-2 text-sm text-ink-muted">{botsEmptyNote(desks)}</p>
        </section>
      ) : null}
      {screen.main === "bots" && screen.sub === "pick" ? (
        <BotStep desks={desks} folders={folders} onChange={updateDesk} />
      ) : null}
      {screen.main === "review" ? (
        <ReviewStep desks={desks} folders={folders} />
      ) : null}
      {screen.main === "tour" ? (
        <TourReady
          desks={desks}
          folders={folders}
          applied={applied}
          issues={summary?.issues ?? []}
        />
      ) : null}
      </div>
      <div className="shrink-0 border-t border-line bg-surface-raised px-6 py-4">
        {error ? (
          <p className="mb-3 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
        {readyForTour ? null : (
        <button
          type="button"
          disabled={pending}
          onClick={restartWizard}
          className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-muted hover:border-line-strong hover:text-ink disabled:opacity-40"
        >
          <IconReset {...WIZARD_ICON} />
          {pending && resetting ? "Resetting…" : "Reset Wizard"}
        </button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
        {screen.main === "intro" ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={enterSetup}
              className="inline-flex items-center gap-1.5 rounded-control px-4 py-2 text-sm text-ink-muted hover:bg-surface hover:text-ink"
            >
              <IconSkipForward {...WIZARD_ICON} />
              Skip
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (playing) {
                  enterSetup();
                  return;
                }
                setPlaying(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              {playing ? null : <IconPlay {...WIZARD_ICON} />}
              {pending ? "Saving…" : playing ? "Continue" : "Watch"}
              {playing ? <IconArrowRight {...WIZARD_ICON} /> : null}
            </button>
          </>
        ) : null}
        {screen.main !== "intro" && previous && !readyForTour ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setScreenId(setupScreenId(previous));
            }}
            className="inline-flex items-center gap-1.5 rounded-control px-4 py-2 text-sm text-ink-muted hover:bg-surface hover:text-ink"
          >
            <IconArrowLeft {...WIZARD_ICON} />
            Back
          </button>
        ) : null}
        {screen.main !== "intro" && next ? (
          <button
            type="button"
            disabled={pending}
            onClick={continueForward}
            className="inline-flex items-center gap-1.5 rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            {screen.main === "review" ? <IconPlus {...WIZARD_ICON} /> : null}
            {pending
              ? next?.main === "tour"
                ? "Creating…"
                : "Saving…"
              : screen.main === "review"
                ? "Create"
                : "Continue"}
            {screen.main === "review" ? null : (
              <IconArrowRight {...WIZARD_ICON} />
            )}
          </button>
        ) : null}
        {screen.main === "tour" ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => finish("not_now")}
              className="inline-flex items-center gap-1.5 rounded-control px-4 py-2 text-sm text-ink-muted hover:bg-surface hover:text-ink"
            >
              <IconClose {...WIZARD_ICON} />
              Not now
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => finish("yes")}
              className="inline-flex items-center gap-1.5 rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              <IconTour {...WIZARD_ICON} />
              {pending ? "Finishing…" : "Start the Tour now"}
            </button>
          </>
        ) : null}
        </div>
        </div>
      </div>
    </div>
    {dialog}
    {deskEditor ? (
      <CreateDeskDialog
        deskType={deskEditor.deskType}
        desk={deskEditor.desk}
        takenNames={takenNames(deskEditor.desk?.key)}
        takenKeys={desks
          .filter((row) => row.key !== deskEditor.desk?.key)
          .map((row) => row.key)}
        onClose={() => setDeskEditor(null)}
        onSave={(desk) => {
          upsertDesk(desk, deskEditor.desk?.key ?? null);
          setDeskEditor(null);
        }}
      />
    ) : null}
    </>
  );
}

function IntroStep({
  playing,
  onWatch,
}: {
  playing: boolean;
  onWatch: () => void;
}) {
  const frame = (
    <>
      <IconPlay size={28} className="mx-auto size-10 text-ink-muted" />
      <p className="mt-3 text-sm font-medium text-ink">
        {playing ? "The explainer video will play here." : "Explainer video"}
      </p>
    </>
  );
  const frameClass =
    "flex aspect-video w-full flex-col items-center justify-center rounded-card border border-line bg-canvas px-6 text-center";
  return (
    <section>
      {playing ? (
        <div className={frameClass}>{frame}</div>
      ) : (
        <button type="button" onClick={onWatch} className={frameClass}>
          {frame}
        </button>
      )}
    </section>
  );
}

function ReviewStep({
  desks,
  folders,
}: {
  desks: SetupDesk[];
  folders: StarterFolder[];
}) {
  const rows = setupReviewRows({ desks, folders });
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">Review</h2>
      <p className="mt-2 text-sm text-ink-muted">
        These desks and bots are created when you click Create.
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">No desks or bots will be created.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-card border border-line">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-medium">Desk</th>
                <th className="px-3 py-2 font-medium">Bots</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-line last:border-b-0">
                  <td className="px-3 py-2 align-top text-ink">{row.name}</td>
                  <td className="px-3 py-2 align-top text-ink">
                    {row.bots.length === 0 ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {row.bots.map((bot) => (
                          <li key={bot.templateId}>
                            <TemplateNameWithParameters
                              name={bot.name}
                              recipe={starterRecipe(folders, bot.templateId)}
                              templateId={bot.templateId}
                              nameClassName=""
                            />
                            {bot.start ? (
                              <span className="text-ink-muted"> · {bot.start}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TourReady({
  desks,
  folders,
  applied,
  issues,
}: {
  desks: SetupDesk[];
  folders: StarterFolder[];
  applied: string[];
  issues: SetupIssue[];
}) {
  const rows = readyDeskRows({ desks, folders, applied });
  return (
    <section>
      {issues.length > 0 ? (
        <>
          <h2 className="text-lg font-semibold tracking-tight">
            Setup finished with errors.
          </h2>
          <ul className="mt-3 space-y-2">
            {issues.map((issue) => (
              <li
                key={`${issue.name}:${issue.message}`}
                className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
              >
                <span className="font-medium text-ink">{issue.name}</span>
                {" — "}
                {issue.message}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-muted">
            Desks that were created are listed below. Loaded bots stay idle or disabled unless you ticked Enable.
          </p>
        </>
      ) : (
        <>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <IconCheck size={20} className="size-5 shrink-0 text-success" aria-hidden />
            Your account is ready.
          </h2>
          <p className="mt-2 text-sm text-ink">
            {desks.length === 0
              ? "No desks or bots were added. Nothing is trading."
              : "Loaded bots stay idle or disabled unless you ticked Enable."}
          </p>
        </>
      )}
      {rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-card border border-line">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-medium">Desk</th>
                <th className="px-3 py-2 font-medium">Bots</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const desk = desks.find((item) => item.key === row.key);
                return (
                <tr key={row.key} className="border-b border-line last:border-b-0">
                  <td className="px-3 py-2 align-top text-ink">{row.name}</td>
                  <td className="px-3 py-2 align-top text-ink">
                    {row.bots.length === 0 ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {row.bots.map((bot) => {
                          const started =
                            desk && desk.armTemplateIds.includes(bot.templateId)
                              ? starterStartedWord(desk.deskType)
                              : null;
                          return (
                            <li key={bot.templateId}>
                              <TemplateNameWithParameters
                                name={bot.name}
                                recipe={starterRecipe(folders, bot.templateId)}
                                templateId={bot.templateId}
                                nameClassName=""
                              />
                              {started ? (
                                <span className="text-ink-muted"> · {started}</span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function ChoiceStep({
  title,
  intro,
  note,
  name,
  value,
  options,
  onChange,
}: {
  title: string;
  intro: string;
  note?: string | null;
  name: string;
  value: string | null;
  options: { value: string; title: string; detail: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted">{intro}</p>
      {note ? <p className="mt-2 text-sm text-ink-muted">{note}</p> : null}
      <div role="radiogroup" aria-label={title} className="mt-4 flex flex-col gap-3">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={
                selected
                  ? "flex cursor-pointer items-center gap-4 rounded-card border border-accent bg-accent/10 px-5 py-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
                  : "flex cursor-pointer items-center gap-4 rounded-card border border-line bg-canvas px-5 py-4 hover:border-line-strong hover:bg-surface-raised has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
              }
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">
                  {option.title}
                </span>
                <span className="mt-1 block text-sm text-ink-muted">
                  {option.detail}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function DeskDetailValue({ value }: { value: string }) {
  if (value === "—") {
    return <span className="text-ink-faint">—</span>;
  }
  return value;
}

function desksForType(desks: readonly SetupDesk[], deskType: DeskType): SetupDesk[] {
  return (["paper", "live"] as const).flatMap((mode) =>
    desks.filter((row) => row.deskType === deskType && row.mode === mode),
  );
}

function DeskStep({
  desks,
  existingNames,
  onCreate,
  onEdit,
  onRemove,
}: {
  desks: SetupDesk[];
  existingNames: string[];
  onCreate: (deskType: DeskType) => void;
  onEdit: (desk: SetupDesk) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">
        Create a few desks now?
      </h2>
      <ul className="mt-4 text-sm">
        {ONBOARDING_DESK_TYPES.map((deskType) => {
          const added = desksForType(desks, deskType);
          return (
            <li key={deskType} className="border-b border-line py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1 font-medium text-ink">
                  {formatDeskType(deskType)}
                </p>
                <TableLabelButton
                  variant="secondary"
                  icon={<IconPlus {...TABLE_BTN_ICON} />}
                  onClick={() => onCreate(deskType)}
                  className="shrink-0"
                >
                  Create Desk
                </TableLabelButton>
              </div>
              {added.length > 0 ? (
                <div className="mt-3 overflow-x-auto rounded-card border border-line">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
                      <tr>
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Mode</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Market</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          Environment
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Key</th>
                        <th className={TABLE_ACTIONS_TH_CLASS}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {added.map((desk) => {
                        const details = setupDeskDetails(desk);
                        return (
                          <tr
                            key={desk.key}
                            className="border-b border-line last:border-b-0"
                          >
                            <td className="px-3 py-2 text-ink" title={desk.name}>
                              {desk.name}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-ink-muted">
                              {details.mode}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-ink-muted">
                              {details.market}
                            </td>
                            <td className="px-3 py-2 text-ink-muted">
                              <DeskDetailValue value={details.environment} />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-ink-muted">
                              <DeskDetailValue value={details.key} />
                            </td>
                            <td className={TABLE_ACTIONS_TD_CLASS}>
                              <TableActions>
                                <TableIconAction
                                  label="Edit"
                                  detail="Change this desk."
                                  onClick={() => onEdit(desk)}
                                >
                                  <IconPencil {...TABLE_BTN_ICON} />
                                </TableIconAction>
                                <TableIconAction
                                  label="Remove"
                                  detail="Drop this desk from setup."
                                  danger
                                  onClick={() => onRemove(desk.key)}
                                >
                                  <IconTrash {...TABLE_BTN_ICON} />
                                </TableIconAction>
                              </TableActions>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-hint text-ink-muted">
        Add nothing to continue without desks. Perps is the ticket. TradingView
        Strategy takes alerts. Those desks do not load starter bots.
      </p>
      <NameHint desks={desks} existingNames={existingNames} />
    </section>
  );
}

function CreateDeskDialog({
  deskType,
  desk,
  takenNames,
  takenKeys,
  onClose,
  onSave,
}: {
  deskType: DeskType;
  desk: SetupDesk | null;
  takenNames: string[];
  takenKeys: string[];
  onClose: () => void;
  onSave: (desk: SetupDesk) => void;
}) {
  const seed =
    desk ??
    makeSetupDesk({
      deskType,
      mode: "paper",
      takenNames,
    });
  const [mode, setMode] = useState(seed.mode);
  const [name, setName] = useState(seed.name);
  const [nameEdited, setNameEdited] = useState(Boolean(desk?.nameEdited));
  const [venue, setVenue] = useState(seed.venue);
  const [environmentId, setEnvironmentId] = useState(seed.environmentId);
  const [choice, setChoice] = useState<BindChoice>(
    desk && !desk.bindLater ? "new" : "later",
  );
  const [connectionId, setConnectionId] = useState<string | null>(
    desk?.connectionId ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const paperVenues = paperVenuesFor(deskType);
  const liveVenues = connectedVenuesFor(deskType);
  const showMarket = mode === "paper" && paperVenues.length > 1;
  const venueDef = getVenue(venue);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      if (host?.querySelector("[role='listbox']")) {
        return;
      }
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [host, onClose]);

  function suggestedName(
    nextMode: "paper" | "live",
    nextVenue: string,
    nextEnvironment: string | null,
  ) {
    const base =
      nextMode === "live"
        ? connectedSetupName(deskType, nextVenue, nextEnvironment)
        : defaultSetupName(deskType, "paper");
    return allocateSetupName(base, takenNames);
  }

  function selectMode(nextMode: "paper" | "live") {
    const nextVenue =
      nextMode === "paper"
        ? (paperVenues.find((item) => item.id === venue)?.id ??
          paperVenues[0]?.id ??
          "bybit")
        : (liveVenues.find((item) => item.id === venue)?.id ??
          liveVenues[0]?.id ??
          "bybit");
    const nextEnvironment =
      nextMode === "live" ? defaultEnvironmentId(nextVenue) : null;
    setMode(nextMode);
    setVenue(nextVenue);
    setEnvironmentId(nextEnvironment);
    setConnectionId(null);
    setChoice("later");
    if (!nameEdited) {
      setName(suggestedName(nextMode, nextVenue, nextEnvironment));
    }
  }

  function selectVenue(nextVenue: string) {
    const nextEnvironment =
      mode === "live" ? defaultEnvironmentId(nextVenue) : null;
    setVenue(nextVenue);
    setEnvironmentId(nextEnvironment);
    setConnectionId(null);
    if (!nameEdited && mode === "live") {
      setName(suggestedName("live", nextVenue, nextEnvironment));
    }
  }

  function selectEnvironment(nextEnvironment: string) {
    setEnvironmentId(nextEnvironment);
    setConnectionId(null);
    if (!nameEdited && mode === "live") {
      setName(suggestedName("live", venue, nextEnvironment));
    }
  }

  function save() {
    const result = setupDeskFromDetails({
      deskType,
      mode,
      name,
      venue,
      environmentId,
      bindLater: mode !== "live" || choice !== "new",
      connectionId: mode === "live" && choice === "new" ? connectionId : null,
      takenNames,
      takenKeys,
      previous: desk,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSave(result.desk);
  }

  return (
    <div
      ref={setHost}
      data-setup-submodal
      className="fixed inset-0 z-[90] flex items-center justify-center bg-canvas/70 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <ModalHost host={host}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-desk-title"
        className="flex max-h-[min(90dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-card border border-line bg-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-line bg-surface-raised px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-surface hover:text-ink"
          >
            <IconClose size={14} className="size-3.5" />
          </button>
          <h2 id="create-desk-title" className="pr-8 text-lg font-semibold text-ink">
            {desk ? "Edit desk" : "Create desk"}
          </h2>
          <p className="mt-1 pr-8 text-sm text-ink-muted">
            {formatDeskTypeChoice(deskType)}
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <label className="block text-sm text-ink">
            Name
            <input
              ref={nameRef}
              value={name}
              maxLength={40}
              onChange={(event) => {
                setName(event.target.value);
                setNameEdited(true);
              }}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-ink">
            Mode
            <AppSelect
              value={mode}
              onChange={(event) =>
                selectMode(event.target.value === "live" ? "live" : "paper")
              }
              className={fieldClass}
            >
              <option value="paper">{formatAccountModeChoice("paper")}</option>
              <option value="live">{formatAccountModeChoice("live")}</option>
            </AppSelect>
          </label>
          {showMarket ? (
            <label className="block text-sm text-ink">
              Market data
              <AppSelect
                value={venue}
                onChange={(event) => selectVenue(event.target.value)}
                className={fieldClass}
              >
                {paperVenues.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </AppSelect>
            </label>
          ) : null}
          {mode === "live" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-ink">
                  Exchange
                  <AppSelect
                    value={venue}
                    onChange={(event) => selectVenue(event.target.value)}
                    className={fieldClass}
                  >
                    {liveVenues.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </AppSelect>
                </label>
                <label className="block text-sm text-ink">
                  Environment
                  <AppSelect
                    value={environmentId ?? ""}
                    onChange={(event) => selectEnvironment(event.target.value)}
                    className={fieldClass}
                  >
                    {(venueDef?.environments ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </AppSelect>
                </label>
              </div>
              <label className="block text-sm text-ink">
                Key
                <AppSelect
                  value={choice}
                  onChange={(event) => {
                    const next = event.target.value === "new" ? "new" : "later";
                    setChoice(next);
                    setConnectionId(null);
                  }}
                  className={fieldClass}
                >
                  <option value="later">Bind later in Desk Settings</option>
                  <option value="new">Add a trade-only key</option>
                </AppSelect>
              </label>
              {choice === "new" && connectionId ? (
                <p className="text-sm text-success">
                  Key saved. It is bound to this desk when you finish.
                </p>
              ) : null}
              {choice === "new" && !connectionId && venueDef ? (
                <SetupKeyForm
                  venueId={venueDef.id}
                  environmentId={environmentId ?? defaultEnvironmentId(venueDef.id)}
                  onSaved={(connection) => {
                    setConnectionId(connection.id);
                    setVenue(connection.venue);
                    setEnvironmentId(connection.environment);
                    setChoice("new");
                  }}
                />
              ) : null}
            </>
          ) : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-line bg-surface-raised px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-control px-4 py-2 text-sm text-ink-muted hover:bg-surface hover:text-ink"
          >
            <IconClose {...WIZARD_ICON} />
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={mode === "live" && choice === "new" && !connectionId}
            className="inline-flex items-center gap-1.5 rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
          >
            {desk ? <IconSave {...WIZARD_ICON} /> : <IconPlus {...WIZARD_ICON} />}
            {desk ? "Save" : "Add desk"}
          </button>
        </div>
      </div>
      </ModalHost>
    </div>
  );
}

function NameHint({
  desks,
  existingNames,
}: {
  desks: SetupDesk[];
  existingNames: string[];
}) {
  const names = validateSetupNames(desks, existingNames);
  if (names.ok || desks.length === 0) {
    return null;
  }
  return <p className="mt-2 text-sm text-danger">{names.error}</p>;
}

function ExchangeStep({
  desks,
  onChange,
  takenNames,
}: {
  desks: SetupDesk[];
  onChange: (key: string, patch: Partial<SetupDesk>) => void;
  takenNames: (exceptKey?: string) => string[];
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Connect the exchange desks
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Two connected desks need two keys. One key cannot feed two desks.
          Demo and Live are the key’s environment. A secret is checked and
          encrypted on the server, and it is not kept in this setup.
        </p>
      </div>
      {desks.map((desk) => (
        <ExchangeDesk
          key={desk.key}
          desk={desk}
          onChange={(patch) => {
            const next = { ...desk, ...patch };
            if (
              !desk.nameEdited &&
              (patch.venue || patch.environmentId) &&
              next.mode === "live"
            ) {
              next.name = allocateSetupName(
                connectedSetupName(
                  next.deskType,
                  next.venue,
                  next.environmentId,
                ),
                takenNames(desk.key),
              );
            }
            onChange(desk.key, next);
          }}
        />
      ))}
    </section>
  );
}

function ExchangeDesk({
  desk,
  onChange,
}: {
  desk: SetupDesk;
  onChange: (patch: Partial<SetupDesk>) => void;
}) {
  const venues = connectedVenuesFor(desk.deskType);
  const venue = getVenue(desk.venue) ?? venues[0];
  const choice: BindChoice = desk.bindLater ? "later" : "new";

  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">
        {desk.name}
        <span className="ml-2 font-normal text-ink-muted">
          {formatDeskType(desk.deskType)}
        </span>
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-ink">
          Exchange
          <AppSelect
            value={desk.venue}
            onChange={(event) => {
              const nextVenue = event.target.value;
              onChange({
                venue: nextVenue,
                environmentId: defaultEnvironmentId(nextVenue),
                connectionId: null,
                bindLater: true,
              });
            }}
            className={fieldClass}
          >
            {venues.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </AppSelect>
        </label>
        <label className="block text-sm text-ink">
          Environment
          <AppSelect
            value={desk.environmentId ?? ""}
            onChange={(event) =>
              onChange({
                environmentId: event.target.value,
                connectionId: null,
                bindLater: true,
              })
            }
            className={fieldClass}
          >
            {(venue?.environments ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </AppSelect>
        </label>
      </div>
      <label className="mt-3 block text-sm text-ink">
        Key
        <AppSelect
          value={choice}
          onChange={(event) => {
            const next = event.target.value as BindChoice;
            onChange({
              bindLater: next === "later",
              connectionId: null,
            });
          }}
          className={fieldClass}
        >
          <option value="later">Bind later in Desk Settings</option>
          <option value="new">Add a trade-only key</option>
        </AppSelect>
      </label>
      {choice === "new" && desk.connectionId ? (
        <p className="mt-3 text-sm text-success">
          Key saved. It is bound to this desk when you finish.
        </p>
      ) : null}
      {choice === "new" && !desk.connectionId && venue ? (
        <SetupKeyForm
          venueId={venue.id}
          environmentId={desk.environmentId ?? defaultEnvironmentId(venue.id)}
          onSaved={(connection) => {
            onChange({
              connectionId: connection.id,
              bindLater: false,
              venue: connection.venue,
              environmentId: connection.environment,
            });
          }}
        />
      ) : null}
    </div>
  );
}

function SetupKeyForm({
  venueId,
  environmentId,
  onSaved,
}: {
  venueId: string;
  environmentId: string;
  onSaved: (connection: SetupConnection) => void;
}) {
  const venue = getVenue(venueId);
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!venue) {
    return null;
  }

  function readForm(form: HTMLFormElement) {
    const data = new FormData(form);
    data.set("venue", venueId);
    data.set("environment", environmentId);
    return data;
  }

  return (
    <form
      className="mt-4 space-y-3"
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        const data = readForm(event.currentTarget);
        startTransition(async () => {
          const saved = await saveSetupConnection(data);
          if (!saved.ok) {
            setOk(false);
            setMessage(saved.error);
            return;
          }
          setOk(true);
          setMessage("Key saved. It is bound to this desk when you finish.");
          onSaved(saved.connection);
        });
      }}
    >
      {venue.credentialFields.map((field) => (
        <label key={field.key} className="block text-sm text-ink">
          {field.label}
          <input
            name={field.key}
            required
            type={field.secret ? "password" : "text"}
            autoComplete={field.secret ? "new-password" : "off"}
            spellCheck={false}
            className={`${fieldClass} ${field.secret ? "" : "font-mono"}`}
          />
        </label>
      ))}
      <label className="block text-sm text-ink">
        Label (optional)
        <input name="label" maxLength={40} className={fieldClass} />
      </label>
      <p className="text-hint text-ink-muted">
        {venue.id === "hyperliquid"
          ? "Paste the account address and an approved agent private key. The secret is encrypted and is not shown again."
          : "Use a trade-only key with no withdrawal permission. The secret is encrypted and is not shown again."}
      </p>
      {message ? (
        <p className={`text-sm ${ok ? "text-success" : "text-danger"}`}>
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={(event) => {
            const form = event.currentTarget.form;
            if (!form) {
              return;
            }
            startTransition(async () => {
              const checked = await checkExchangeConnection(readForm(form));
              setOk(checked.ok);
              setMessage(checked.ok ? "Connection checks out." : checked.error);
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink"
        >
          <IconCheck {...WIZARD_ICON} />
          {pending ? "Checking…" : "Check connection"}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          <IconSave {...WIZARD_ICON} />
          Save key
        </button>
      </div>
    </form>
  );
}

function BotStep({
  desks,
  folders,
  onChange,
}: {
  desks: SetupDesk[];
  folders: StarterFolder[];
  onChange: (key: string, patch: Partial<SetupDesk>) => void;
}) {
  const rows = starterBotDesks(desks, folders);
  const showFolder = rows.some((desk) =>
    foldersForDesk(folders, desk.deskType).some((folder) => !folder.loose),
  );
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">
        Load starter bots?
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        These are platform templates and folders marked Include in Starter Pack.
        Tick Initial Status to start a bot when setup finishes. Leave it clear
        and the bot stays idle or disabled.
      </p>
      <div className="mt-4 overflow-x-auto rounded-card border border-line">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-3 py-2 font-medium">Desk</th>
              {showFolder ? (
                <th className="whitespace-nowrap px-3 py-2 font-medium">
                  Folder
                </th>
              ) : null}
              <th className="px-3 py-2 font-medium">Bot</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Mode</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Type</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">
                Initial Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((desk) => {
              const details = setupDeskDetails(desk);
              const deskType = formatDeskType(desk.deskType);
              function choose(templateIds: string[]) {
                onChange(desk.key, {
                  templateIds,
                  armTemplateIds: keptArmTemplateIds({
                    mode: desk.mode,
                    connectionId: desk.connectionId,
                    templateIds,
                    armTemplateIds: desk.armTemplateIds,
                  }),
                });
              }
              return foldersForDesk(folders, desk.deskType).flatMap((folder) => {
                const ids = folder.templates.map((template) => template.id);
                const selectedCount = ids.filter((id) =>
                  desk.templateIds.includes(id),
                ).length;
                const all = ids.length > 0 && selectedCount === ids.length;
                return folder.templates.map((template, index) => (
                  <tr
                    key={`${desk.key}:${template.id}`}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className="px-3 py-2 text-ink">{desk.name}</td>
                    {showFolder ? (
                      <td className="whitespace-nowrap px-3 py-2 text-ink">
                        {folder.loose ? (
                          <span className="text-ink-faint">—</span>
                        ) : index === 0 ? (
                          <label className="inline-flex items-center gap-2">
                            <AppCheck
                              checked={all}
                              className=""
                              onChange={() => {
                                if (all) {
                                  choose(
                                    desk.templateIds.filter(
                                      (id) => !ids.includes(id),
                                    ),
                                  );
                                  return;
                                }
                                choose([
                                  ...new Set([...desk.templateIds, ...ids]),
                                ]);
                              }}
                            />
                            {folder.name}
                          </label>
                        ) : (
                          <span className="text-ink-muted">{folder.name}</span>
                        )}
                      </td>
                    ) : null}
                    <td className="px-3 py-2 text-ink">
                      <label className="inline-flex items-center gap-2">
                        <AppCheck
                          checked={desk.templateIds.includes(template.id)}
                          className=""
                          onChange={() => {
                            const next = new Set(desk.templateIds);
                            if (next.has(template.id)) {
                              next.delete(template.id);
                            } else {
                              next.add(template.id);
                            }
                            choose([...next]);
                          }}
                        />
                        <TemplateNameWithParameters
                          name={template.name}
                          recipe={template.recipe}
                          templateId={template.id}
                          nameClassName=""
                        />
                      </label>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-muted">
                      {details.mode}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-muted">
                      {deskType}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <StarterInitialStatus
                        desk={desk}
                        templateId={template.id}
                        templateName={template.name}
                        onChange={onChange}
                      />
                    </td>
                  </tr>
                ));
              });
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function starterRecipe(folders: readonly StarterFolder[], templateId: string) {
  for (const folder of folders) {
    const match = folder.templates.find((row) => row.id === templateId);
    if (match?.recipe) {
      return match.recipe;
    }
  }
  return null;
}

function StarterInitialStatus({
  desk,
  templateId,
  templateName,
  onChange,
}: {
  desk: SetupDesk;
  templateId: string;
  templateName: string;
  onChange: (key: string, patch: Partial<SetupDesk>) => void;
}) {
  if (!starterStartVerb(desk.deskType)) {
    return <span className="text-ink-faint">—</span>;
  }
  const selected = desk.templateIds.includes(templateId);
  const canStart = setupDeskCanStartBots(desk);
  const armed = selected && desk.armTemplateIds.includes(templateId);
  return (
    <AppCheck
      aria-label={`Initial status for ${templateName}`}
      checked={armed}
      disabled={!selected || !canStart}
      className=""
      title={
        canStart
          ? desk.deskType === "dca"
            ? "Start this bot when setup finishes. An immediate start can place the first order."
            : "Start this bot when setup finishes."
          : "Bind a key before this bot can start."
      }
      onChange={() => {
        const next = new Set(desk.armTemplateIds);
        if (next.has(templateId)) {
          next.delete(templateId);
        } else {
          next.add(templateId);
        }
        onChange(desk.key, { armTemplateIds: [...next] });
      }}
    />
  );
}
