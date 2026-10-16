import type { ReactNode } from "react";
import { AutomationsEditHeading } from "@/components/automations-saved-edit";
import { AutomationsHashEdit } from "@/components/automations-hash-edit";
import { DeskBackLink } from "@/components/desk-back-link";
import { QuotaRejectNotices } from "@/components/desk-type-reject";

export function AutomationsPageFrame({
  listHref,
  editTitle,
  existingBot = false,
  children,
}: {
  listHref: string;
  editTitle?: string | null;
  existingBot?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      {existingBot ? null : <QuotaRejectNotices keys={["max_bots"]} />}
      <AutomationsHashEdit listHref={listHref} />
      {editTitle ? (
        <div className="mb-6 flex min-w-0 items-center gap-3">
          <DeskBackLink href={listHref} />
          <AutomationsEditHeading title={editTitle} />
        </div>
      ) : null}
      {children}
    </main>
  );
}
