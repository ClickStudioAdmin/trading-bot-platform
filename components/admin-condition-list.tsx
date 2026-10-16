import { BacktestParameterSections } from "@/components/backtest-parameter-sections";
import { adminConditionReview } from "@/lib/backtest/condition-list-samples";

export function AdminConditionList() {
  const samples = adminConditionReview();
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-ink-muted">
        Parameter lists for entry and custom exit stacks. Group cards and the
        And / Or joiners match the bot form. Template parameters, replay, and
        backtest detail use this same list.
      </p>
      {samples.map((sample) => (
        <section key={sample.title} className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{sample.title}</h2>
            <p className="mt-1 text-sm text-ink-muted">{sample.detail}</p>
          </div>
          <BacktestParameterSections sections={sample.sections} />
        </section>
      ))}
    </div>
  );
}
