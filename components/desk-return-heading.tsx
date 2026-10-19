import type { ReactNode } from "react";
import { DeskBackLink } from "@/components/desk-back-link";

export function DeskReturnHeading({
  title,
  backHref,
  meta,
  actions,
  className = "mb-6",
  showTitle = true,
}: {
  title: string;
  backHref?: string | null;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  showTitle?: boolean;
}) {
  const showIdentity = showTitle || Boolean(backHref);
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-2 ${className}`.trim()}>
      {showIdentity ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-1">
          <div className="flex min-w-0 items-center gap-3">
            {backHref ? <DeskBackLink href={backHref} /> : null}
            {showTitle ? (
              <h2 className="min-w-0 text-lg font-semibold tracking-tight">{title}</h2>
            ) : null}
          </div>
          {showTitle && meta ? <div className="min-w-0">{meta}</div> : null}
        </div>
      ) : null}
      {actions ? (
        <div className="mb-0.5 ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
