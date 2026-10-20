import { ContainerLoading } from "@/components/container-loading";
import { TableCard } from "@/components/table-chrome";

export default function CashAndCarryPositionsLoading() {
  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <div className="space-y-6">
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
