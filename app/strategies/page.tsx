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
        Sign in to open a typed desk. Type locks the manager: Cash and Carry,
        Perps, TradingView Strategy, or DCA.
      </p>
      <p className="mt-8 text-sm">
        <Link href="/sign-in" className="text-accent hover:text-accent-strong">
          Sign in
        </Link>
      </p>
    </main>
  );
}
