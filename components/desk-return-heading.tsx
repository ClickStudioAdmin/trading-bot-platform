import type { ReactNode } from "react";
import { DeskBackLink } from "@/components/desk-back-link";
import { PageHeading } from "@/components/page-heading";

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
      <PageHeading
        as="h2"
        title={title}
        className={className}
        actions={actions}
      />
    );
  }
  return (
    <div className={`flex items-end justify-between gap-3 ${className}`.trim()}>
      <div className="flex min-w-0 items-center gap-3">
        <DeskBackLink href={backHref} />
        <h2 className="min-w-0 text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      {actions ? (
        <div className="mb-0.5 flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
