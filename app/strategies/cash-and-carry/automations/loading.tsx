import { ContainerLoading } from "@/components/container-loading";
import { PageHeading } from "@/components/page-heading";
import { TableCard } from "@/components/table-chrome";

export default function CashAndCarryAutomationsLoading() {
  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Bots" />
      <TableCard className="mt-6">
        <div className="px-5 py-8">
          <ContainerLoading label="Loading bots" />
        </div>
      </TableCard>
    </main>
  );
}
