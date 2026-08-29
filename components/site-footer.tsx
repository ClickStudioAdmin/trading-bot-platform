import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";
import { formatDeskType, type DeskType } from "@/lib/accounts/model";

const FOOTER_DESKS: { id: string; deskType: DeskType }[] = [
  { id: "cash-and-carry", deskType: "cash_and_carry" },
  { id: "perps", deskType: "perps" },
  { id: "tradingview-strategy", deskType: "signal_follower" },
  { id: "dca", deskType: "dca" },
];

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <footer className="mt-auto border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <p className="text-xs text-ink-faint">
            Trading Bot Platform · Development
          </p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <SiteLogo />
          <p className="mt-3 max-w-sm text-sm text-ink-muted">
            Your strategies. Your keys. One desk.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">
            Desks
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {FOOTER_DESKS.map((row) => (
              <li key={row.deskType}>
                <Link
                  href={`/#${row.id}`}
                  className="text-ink-muted hover:text-ink"
                >
                  {formatDeskType(row.deskType)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">
            Desk
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/#how-it-works" className="text-ink-muted hover:text-ink">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/sign-in" className="text-ink-muted hover:text-ink">
                Sign in
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-6 py-4 text-xs text-ink-faint">
          Trading Bot Platform · Development
        </p>
      </div>
    </footer>
  );
}
