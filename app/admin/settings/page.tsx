import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = {
  title: "Admin settings",
  description: "System settings for Trading Bot Platform.",
};

export default function AdminSettingsPage() {
  return (
    <div>
      <PageHeading overline="Admin" title="Settings" />
      <p className="-mt-4 text-sm text-ink-muted">
        System settings will land here. Members and logs are in the menu.
      </p>
    </div>
  );
}
