import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
        TBP
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
        Trading Bot Platform
      </h1>
      <p className="mt-3 text-sm text-ink-muted">
        TBP development environment is operational.
      </p>
      <p className="mt-8 text-sm text-ink-faint">Build: 002</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/cash-and-carry"
          className="inline-flex rounded-control border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-surface-raised"
        >
          Cash and carry
        </Link>
        <Link
          href="/theme"
          className="inline-flex rounded-control border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
        >
          Theme reference
        </Link>
      </div>
    </main>
  );
}
