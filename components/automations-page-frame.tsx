import type { ReactNode } from "react";
import { AutomationsHashEdit } from "@/components/automations-hash-edit";
import { Breadcrumbs } from "@/components/breadcrumbs";
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
        <Breadcrumbs
          items={[
            { href: listHref, label: "Automations (bots)" },
            { label: editTitle },
          ]}
        />
      ) : null}
      <PageHeading as="h2" title={editTitle ?? "Automations (bots)"} />
      {children}
    </main>
  );
}
