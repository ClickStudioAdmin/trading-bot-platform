import Link from "next/link";
import { pairPageLabel } from "@/lib/pairs/page";

export function PairPager({
  page,
  pageCount,
  total,
  from,
  to,
  prevHref,
  nextHref,
}: {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  prevHref: string;
  nextHref: string;
}) {
  if (total === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
      <p>{pairPageLabel({ page, total, from, to })}</p>
      {pageCount > 1 ? (
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={prevHref}
              className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Previous
            </Link>
          ) : null}
          {page < pageCount ? (
            <Link
              href={nextHref}
              className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
