import type { ParamSection } from "@/lib/backtest/param-sections";

export function BacktestParameterSections({
  sections,
}: {
  sections: ParamSection[];
}) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.title}>
          <h3 className="mb-2 text-sm font-semibold text-ink">{section.title}</h3>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {section.groups.map((group, index) => (
              <div
                key={`${group.title ?? "fields"}-${index}`}
                className={index > 0 ? "border-t border-line" : undefined}
              >
                {group.title ? (
                  <p className="bg-surface-raised px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                    {group.title}
                  </p>
                ) : null}
                {group.rows.length > 0 ? (
                  <dl className="divide-y divide-line">
                    {group.rows.map((row, rowIndex) => (
                      <div
                        key={`${row.label}-${rowIndex}`}
                        className="flex items-baseline justify-between gap-4 px-5 py-2.5"
                      >
                        <dt className="shrink-0 text-xs uppercase tracking-[0.12em] text-ink-muted">
                          {row.label}
                        </dt>
                        <dd className="min-w-0 text-right text-sm font-medium tabular-nums">
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
