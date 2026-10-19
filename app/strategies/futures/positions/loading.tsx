import { ContainerLoading } from "@/components/container-loading";
import { TableCard } from "@/components/table-chrome";
import { deskAllowsManualPerpTicket } from "@/lib/accounts/model";
import { getSessionContext } from "@/lib/auth/session";

function LoadingStat({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
      {label}
      <ContainerLoading />
    </span>
  );
}

export default async function FuturesPositionsLoading() {
  const session = await getSessionContext();
  const manual = session ? deskAllowsManualPerpTicket(session.account) : true;
  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <div className="space-y-6">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Positions Snapshot
        </h2>
        <p className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <LoadingStat label="Open value" />
          <LoadingStat label="Unrealized P&L" />
          <LoadingStat label="Open exposure" />
        </p>
        {manual ? (
          <div className="@container">
            <div className="grid items-start gap-4 @min-[960px]:grid-cols-[minmax(0,1fr)_22.5rem]">
              <div className="flex h-[28rem] items-center justify-center rounded-card border border-line bg-canvas @min-[960px]:h-[40rem]">
                <ContainerLoading label="Loading chart" />
              </div>
              <section>
                <h2 className="text-lg font-semibold tracking-tight">
                  Place an order
                </h2>
                <div className="mt-3 rounded-card border border-line bg-surface p-5">
                  <ContainerLoading label="Loading order ticket" />
                </div>
              </section>
            </div>
          </div>
        ) : null}
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Current Positions
        </h2>
        <TableCard className="mt-0 min-w-0">
          <div className="px-5 py-8">
            <ContainerLoading label="Loading positions" />
          </div>
        </TableCard>
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-ink">
            Open Orders
          </h2>
          <TableCard className="mt-0">
            <div className="px-5 py-8">
              <ContainerLoading label="Loading orders" />
            </div>
          </TableCard>
        </section>
      </div>
    </main>
  );
}
