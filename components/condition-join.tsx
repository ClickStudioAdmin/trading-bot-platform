import type { ReactNode } from "react";

/** Helper beside the group title on every condition builder. */
export const CONDITION_GROUP_HELPER = "Fires when all conditions are true.";

export function Hairline({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-3">
      <span className="h-px min-w-0 flex-1 bg-line" aria-hidden />
      {children}
      <span className="h-px min-w-0 flex-1 bg-line" aria-hidden />
    </div>
  );
}

export function JoinWord({ label }: { label: "And" | "Or" }) {
  return (
    <Hairline>
      <span className="inline-flex shrink-0 rounded-md bg-join px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
        {label}
      </span>
    </Hairline>
  );
}
