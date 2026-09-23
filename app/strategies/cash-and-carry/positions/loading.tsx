import { ContainerLoading } from "@/components/container-loading";
import { TableCard } from "@/components/table-chrome";

function LoadingStat({ label }: { label: string }) {
  return (
    <div className="h-full rounded-card border border-line bg-surface p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <div className="mt-3 flex h-8 items-center">
        <ContainerLoading />
      </div>
    </div>
  );
}

export default function CashAndCarryPositionsLoading() {
  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <div className="space-y-6">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Positions Snapshot
        </h2>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <LoadingStat label="Open value" />
          <LoadingStat label="Unrealized P&L" />
          <LoadingStat label="Open exposure" />
        </section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Current Positions
        </h2>
        <TableCard className="mt-0 min-w-0">
          <div className="px-5 py-8">
            <ContainerLoading label="Loading positions" />
          </div>
        </TableCard>
      </div>
    </main>
  );
}
