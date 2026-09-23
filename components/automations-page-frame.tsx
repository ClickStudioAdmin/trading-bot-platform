import type { ReactNode } from "react";
import { AutomationsHashEdit } from "@/components/automations-hash-edit";
import { DeskBackLink } from "@/components/desk-back-link";
import { PageHeading } from "@/components/page-heading";

export function AutomationsPageFrame({
  listHref,
  editTitle,
  children,
}: {
  listHref: string;
  editTitle?: string | null;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <AutomationsHashEdit listHref={listHref} />
      {editTitle ? (
        <div className="mb-6 flex min-w-0 items-center gap-3">
          <DeskBackLink href={listHref} />
          <PageHeading as="h2" title={editTitle} className="mb-0 min-w-0" />
        </div>
      ) : (
        <PageHeading as="h2" title="Bots" />
      )}
      {children}
    </main>
  );
}
