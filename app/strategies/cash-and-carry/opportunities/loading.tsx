import { ContainerLoading } from "@/components/container-loading";
import { PageHeading } from "@/components/page-heading";
import { TableCard } from "@/components/table-chrome";

const STATS = [
  "Pairs scanned",
  "Best net APR",
  "Positive / negative basis",
  "Usable book",
];

export default function OpportunitiesLoading() {
  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Market snapshot
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((label) => (
            <div
              key={label}
              className="rounded-card border border-line bg-surface p-5"
            >
              <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                {label}
              </p>
              <div className="mt-3 flex h-8 items-center">
                <ContainerLoading />
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="mt-6">
        <PageHeading as="h2" title="Opportunities" />
        <TableCard className="mt-6">
          <div className="px-5 py-8">
            <ContainerLoading label="Loading opportunities" />
          </div>
        </TableCard>
      </div>
    </main>
  );
}
