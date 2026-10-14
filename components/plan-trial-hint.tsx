import type { ReactNode } from "react";
import { ColumnHint } from "@/components/column-hint";
import { LocalTime } from "@/components/local-time";
import type { TrialPhase } from "@/lib/membership/trials";

export function PlanTrialHint({
  phase,
  endsAt,
  children,
  className,
}: {
  phase: TrialPhase | "offer";
  endsAt: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ColumnHint
      label={<span className={className}>{children}</span>}
      hint={<TrialEndCopy phase={phase} endsAt={endsAt} />}
    />
  );
}

export function trialEmphasisClass(phase: TrialPhase | "offer"): string {
  if (phase === "ended") {
    return "border-b border-dashed border-ink-faint text-ink-faint";
  }
  return "border-b border-dashed border-warning text-warning";
}

export function trialBadgeClass(phase: TrialPhase | "offer"): string {
  const shape =
    "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums";
  if (phase === "ended") {
    return `${shape} bg-surface-raised text-ink-faint`;
  }
  return `${shape} bg-warning/15 text-warning`;
}

export function FreeTrialBadge({ message }: { message: string }) {
  return (
    <ColumnHint
      label={
        <span className={trialBadgeClass("active")} aria-label={message}>
          Free Trial
        </span>
      }
      hint={message}
    />
  );
}

export function FreeTrialBadges({
  messages,
  className = "flex flex-wrap items-center gap-2",
}: {
  messages: readonly string[];
  className?: string;
}) {
  if (messages.length === 0) {
    return null;
  }
  return (
    <div className={className}>
      {messages.map((message) => (
        <FreeTrialBadge key={message} message={message} />
      ))}
    </div>
  );
}

function TrialEndCopy({
  phase,
  endsAt,
}: {
  phase: TrialPhase | "offer";
  endsAt: string | null;
}) {
  if (phase === "offer" || !endsAt) {
    return (
      <>
        Free trial. The end date is set when this plan applies. Saved work from
        the trial stays open after it ends. New work needs a plan that includes
        it.
      </>
    );
  }
  if (phase === "ended") {
    return (
      <>
        Free trial ended <LocalTime at={endsAt} mode="date" />. Saved work from
        the trial stays open. New work needs a plan that includes it.
      </>
    );
  }
  return (
    <>
      Free trial ends <LocalTime at={endsAt} mode="date" />.
    </>
  );
}
