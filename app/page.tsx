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
        TBP development environment is operational. Open Strategies from the
        menu, then Universe for the live book and paper trades.
      </p>
      <p className="mt-8 text-sm text-ink-faint">Build: 002</p>
    </main>
  );
}
