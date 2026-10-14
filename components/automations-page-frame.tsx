import type { ReactNode } from "react";
import { AutomationsHashEdit } from "@/components/automations-hash-edit";
import { DeskBackLink } from "@/components/desk-back-link";
import { QuotaRejectNotices } from "@/components/desk-type-reject";

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
      <QuotaRejectNotices keys={["max_bots"]} />
      <AutomationsHashEdit listHref={listHref} />
      {editTitle ? (
        <div className="mb-6 flex min-w-0 items-center gap-3">
          <DeskBackLink href={listHref} />
          <h2 className="min-w-0 text-lg font-semibold tracking-tight">
            {editTitle}
          </h2>
        </div>
      ) : null}
      {children}
    </main>
  );
}
