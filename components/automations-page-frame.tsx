import Link from "next/link";
import type { ReactNode } from "react";
import { AutomationsHashEdit } from "@/components/automations-hash-edit";
import { IconArrowLeft } from "@/components/icons";
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
          <Link
            href={listHref}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
          >
            <IconArrowLeft size={16} className="size-4" />
            Back
          </Link>
          <PageHeading as="h2" title={editTitle} className="mb-0 min-w-0" />
        </div>
      ) : (
        <PageHeading as="h2" title="Automations (bots)" />
      )}
      {children}
    </main>
  );
}
