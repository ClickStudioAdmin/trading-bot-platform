import { ContainerLoading } from "@/components/container-loading";
import { TableCard } from "@/components/table-chrome";

function LoadingStat({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
      {label}
      <ContainerLoading />
    </span>
  );
}

export default function CashAndCarryPositionsLoading() {
  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <div className="space-y-6">
        <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Positions Snapshot
          </h2>
          <p className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <LoadingStat label="Open value" />
            <LoadingStat label="Unrealized P&L" />
            <LoadingStat label="Open exposure" />
          </p>
        </div>
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
