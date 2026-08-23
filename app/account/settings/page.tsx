import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = {
  title: "Settings",
  description: "Account settings.",
};

export default function AccountSettingsPage() {
  return (
    <div>
      <PageHeading title="Settings" />
      <p className="-mt-4 text-sm text-ink-muted">
        Account settings will live here.
      </p>
    </div>
  );
}
