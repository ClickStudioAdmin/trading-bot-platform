import { ContainerLoading } from "@/components/container-loading";
import { TableCard } from "@/components/table-chrome";

export default function FuturesAutomationsLoading() {
  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <h2 className="mb-6 text-lg font-semibold tracking-tight">Bots</h2>
      <TableCard className="mt-6">
        <div className="px-5 py-8">
          <ContainerLoading label="Loading bots" />
        </div>
      </TableCard>
    </main>
  );
}
