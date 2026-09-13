import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { redirectSignedInHome } from "@/lib/auth/onboarding";

export const metadata: Metadata = {
  title: "Desks",
  description: "Open the current desk.",
};

export default async function StrategiesPage() {
  await redirectSignedInHome();

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <PageHeading overline="Desk" title="Desks" />
      <p className="-mt-2 text-sm text-ink-muted">
        Create a free account to open a typed desk. Type locks the manager:
        Cash and Carry, Perps, TradingView Strategy, or DCA.
      </p>
      <p className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link href="/sign-up" className="text-accent hover:text-accent-strong">
          Start free
        </Link>
        <Link href="/sign-in" className="text-ink-muted hover:text-ink">
          Sign in
        </Link>
      </p>
    </main>
  );
}
