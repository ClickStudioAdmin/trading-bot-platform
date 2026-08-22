import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = {
  title: "Settings",
  description: "Cash-and-carry strategy settings.",
};

export default function CashAndCarrySettingsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Settings" />
      <p className="-mt-4 text-sm text-ink-muted">
        Strategy settings will land here. Automations stay on their own page.
      </p>
    </main>
  );
}
