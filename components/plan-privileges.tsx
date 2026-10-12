import { IconCheck } from "@/components/icons";
import { PlanTrialHint, trialEmphasisClass } from "@/components/plan-trial-hint";
import type { PlanOverviewGroup } from "@/lib/membership/plan-overview";

export function PlanPrivileges({ groups }: { groups: PlanOverviewGroup[] }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold tracking-tight">
        Privileges and usage
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        What this plan includes, and how much of each maximum is in use.
      </p>
      <div className="mt-5 columns-1 gap-x-10 sm:columns-2 xl:columns-3">
        {groups.map((group) => (
          <div key={group.title} className="mb-6 break-inside-avoid">
            <h3 className="text-xs uppercase tracking-[0.12em] text-ink-muted">
              {group.title}
            </h3>
            <dl className="mt-2 space-y-1.5">
              {group.lines.map((line) => (
                <div key={line.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <dt className="text-ink">{line.label}</dt>
                    <dd
                      className={`tabular-nums ${
                        line.trial?.emphasize
                          ? ""
                          : line.over
                            ? "text-warning"
                            : "text-ink-muted"
                      }`}
                    >
                      {line.included ? (
                        <span
                          className="inline-flex text-success"
                          aria-label="Included"
                        >
                          <IconCheck size={16} className="size-4" />
                        </span>
                      ) : line.trial ? (
                        <PlanTrialHint
                          phase={line.trial.phase}
                          endsAt={line.trial.endsAt}
                          className={
                            line.trial.emphasize
                              ? trialEmphasisClass(line.trial.phase)
                              : undefined
                          }
                        >
                          {line.text}
                        </PlanTrialHint>
                      ) : (
                        line.text
                      )}
                    </dd>
                  </div>
                  {line.note ? (
                    <p className="text-hint text-ink-muted">{line.note}</p>
                  ) : null}
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
