import type { ReactNode } from "react";
import { AutomationsEditHeading } from "@/components/automations-saved-edit";
import { AutomationsHashEdit } from "@/components/automations-hash-edit";
import { DeskBackLink } from "@/components/desk-back-link";
import { QuotaRejectNotices } from "@/components/desk-type-reject";
import { BotFormSideSlot } from "@/components/param-side-filter";

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
        <div className="mb-6 grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-w-0 items-center gap-3">
            <DeskBackLink href={listHref} />
            <AutomationsEditHeading title={editTitle} />
            <BotFormSideSlot />
          </div>
        </div>
      ) : null}
      {children}
    </main>
  );
}
