import type { ReactNode } from "react";
import { DeskBackLink } from "@/components/desk-back-link";

export function DeskReturnHeading({
  title,
  backHref,
  meta,
  actions,
  className = "mb-6",
}: {
  title: string;
  backHref?: string | null;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-2 ${className}`.trim()}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-1">
        <div className="flex min-w-0 items-center gap-3">
          {backHref ? <DeskBackLink href={backHref} /> : null}
          <h2 className="min-w-0 text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        {meta ? <div className="min-w-0">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="mb-0.5 flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
