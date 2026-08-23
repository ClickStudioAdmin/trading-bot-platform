import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = {
  title: "Exchanges",
  description: "Connected exchanges.",
};

export default function AccountExchangesPage() {
  return (
    <div>
      <PageHeading title="Exchanges" />
      <p className="-mt-4 text-sm text-ink-muted">
        Exchange connections will live here.
      </p>
    </div>
  );
}
