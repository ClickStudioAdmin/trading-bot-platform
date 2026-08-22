import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = {
  title: "Admin settings",
  description: "System settings for Trading Bot Platform.",
};

export default function AdminSettingsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeading overline="Admin" title="Settings" />
      <p className="-mt-4 text-sm text-ink-muted">
        System settings will land here. Members and logs are on their own tabs.
      </p>
    </main>
  );
}
