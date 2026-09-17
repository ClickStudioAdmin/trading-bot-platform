import { TablePager } from "@/components/table-chrome";

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
  return (
    <TablePager
      window={{
        page,
        pageCount,
        total,
        from: total === 0 ? 0 : from + 1,
        to,
      }}
      prevHref={prevHref}
      nextHref={nextHref}
      emptyLabel="No pairs."
    />
  );
}
