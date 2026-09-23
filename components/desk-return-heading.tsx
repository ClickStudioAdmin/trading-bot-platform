import type { ReactNode } from "react";
import { DeskBackLink } from "@/components/desk-back-link";

export function DeskReturnHeading({
  title,
  backHref,
  actions,
  className = "mb-6",
}: {
  title: string;
  backHref?: string | null;
  actions?: ReactNode;
  className?: string;
}) {
  if (!backHref) {
    return (
      <div className={`flex items-end justify-between gap-3 ${className}`.trim()}>
        <h2 className="min-w-0 text-lg font-semibold tracking-tight">{title}</h2>
        {actions ? (
          <div className="mb-0.5 flex shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className={`flex items-end justify-between gap-3 ${className}`.trim()}>
      <div className="flex min-w-0 items-center gap-3">
        <DeskBackLink href={backHref} />
        <h2 className="min-w-0 text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {actions ? (
        <div className="mb-0.5 flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
