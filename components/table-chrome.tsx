"use client";

import Link from "next/link";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LiveFilterSubmit } from "@/components/app-select";
import {
  formatStatusLabel,
  sliceTablePage,
  statusToneFor,
  tablePageLabel,
  toggleTableSortDir,
  type StatusTone,
  type TablePageWindow,
  type TableSortDir,
} from "@/lib/table-chrome";

export const TABLE_FILTER_FIELD_CLASS =
  "mt-1 w-full min-w-[9rem] rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";
export const TABLE_FILTER_CLEAR_CLASS =
  "rounded-control border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink";
export const TABLE_PAGER_BTN_CLASS =
  "rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-40";

const BADGE_TONE: Record<StatusTone, string> = {
  success: "rounded-full bg-success/15 px-2.5 py-0.5 text-xs text-success",
  warning: "rounded-full bg-warning/15 px-2.5 py-0.5 text-xs text-warning",
  danger: "rounded-full bg-danger/15 px-2.5 py-0.5 text-xs text-danger",
  accent: "rounded-full bg-accent/15 px-2.5 py-0.5 text-xs text-accent",
  muted: "rounded-full bg-ink-faint/15 px-2.5 py-0.5 text-xs text-ink-muted",
};

export function StatusBadge({
  label,
  tone,
  status,
}: {
  label: string;
  tone?: StatusTone;
  status?: string;
}) {
  const resolved = tone ?? statusToneFor(status ?? label);
  return <span className={BADGE_TONE[resolved]}>{formatStatusLabel(label)}</span>;
}

export function TableFilterBar({
  children,
  className = "mt-6",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border border-line bg-surface p-4 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-end gap-3">{children}</div>
    </div>
  );
}

export function TableFilterField({
  label,
  className = "min-w-[10rem] flex-1",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block text-xs text-ink-muted ${className}`.trim()}>
      {label}
      {children}
    </label>
  );
}

export function LiveGetForm({
  children,
  className = "mt-6",
  action,
}: {
  children: ReactNode;
  className?: string;
  action?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<number>(0);
  const submit = useCallback(() => submitFilters(formRef.current), []);

  function onChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLSelectElement)
    ) {
      return;
    }
    if (target.name === "page") {
      return;
    }
    const searchLike =
      target instanceof HTMLInputElement &&
      (target.type === "search" ||
        target.type === "text" ||
        target.type === "number" ||
        target.inputMode === "decimal");
    window.clearTimeout(timer.current);
    if (searchLike) {
      timer.current = window.setTimeout(() => {
        submitFilters(formRef.current);
      }, 300);
      return;
    }
    submitFilters(formRef.current);
  }

  return (
    <LiveFilterSubmit.Provider value={submit}>
      <form
        ref={formRef}
        method="get"
        action={action}
        onChange={onChange}
        className={`rounded-card border border-line bg-surface p-4 ${className}`.trim()}
      >
        <div className="flex flex-wrap items-end gap-3">{children}</div>
      </form>
    </LiveFilterSubmit.Provider>
  );
}

function submitFilters(form: HTMLFormElement | null) {
  if (!form) {
    return;
  }
  const page = form.elements.namedItem("page");
  if (page instanceof HTMLInputElement) {
    page.value = "1";
  }
  form.requestSubmit();
}

export function TablePager({
  window,
  prevHref,
  nextHref,
  onPrev,
  onNext,
  emptyLabel,
}: {
  window: Pick<TablePageWindow, "page" | "pageCount" | "total" | "from" | "to">;
  prevHref?: string;
  nextHref?: string;
  onPrev?: () => void;
  onNext?: () => void;
  emptyLabel?: string;
}) {
  if (window.total === 0) {
    return null;
  }
  const showButtons = window.pageCount > 1;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
      <p>{tablePageLabel({ ...window, empty: emptyLabel })}</p>
      {showButtons ? (
        <div className="flex gap-2">
          {window.page > 1 ? (
            prevHref ? (
              <Link href={prevHref} className={TABLE_PAGER_BTN_CLASS}>
                Previous
              </Link>
            ) : (
              <button type="button" onClick={onPrev} className={TABLE_PAGER_BTN_CLASS}>
                Previous
              </button>
            )
          ) : null}
          {window.page < window.pageCount ? (
            nextHref ? (
              <Link href={nextHref} className={TABLE_PAGER_BTN_CLASS}>
                Next
              </Link>
            ) : (
              <button type="button" onClick={onNext} className={TABLE_PAGER_BTN_CLASS}>
                Next
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function useClientTable<T>(
  rows: readonly T[],
  compare: (left: T, right: T, key: string, dir: TableSortDir) => number,
  options?: {
    pageSize?: number;
    defaultKey?: string;
    defaultDir?: TableSortDir;
  },
) {
  const defaultKey = options?.defaultKey ?? "";
  const defaultDir = options?.defaultDir ?? "asc";
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState<TableSortDir>(defaultDir);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sortKey) {
      copy.sort((left, right) => compare(left, right, sortKey, sortDir));
    }
    return copy;
  }, [compare, rows, sortDir, sortKey]);

  const sliced = sliceTablePage(sorted, page, options?.pageSize);

  useEffect(() => {
    if (page !== sliced.window.page) {
      setPage(sliced.window.page);
    }
  }, [page, sliced.window.page]);

  function onSort(key: string) {
    setSortDir((current) => toggleTableSortDir(sortKey, key, current, defaultDir));
    setSortKey(key);
    setPage(1);
  }

  return {
    pageRows: sliced.rows,
    window: sliced.window,
    sortKey,
    sortDir,
    onSort,
    setPage,
  };
}

export function SortTh({
  label,
  active,
  dir,
  onSort,
  href,
}: {
  label: string;
  active: boolean;
  dir: TableSortDir;
  onSort?: () => void;
  href?: string;
}) {
  const marker = active ? (dir === "asc" ? " ↑" : " ↓") : "";
  const className = active ? "text-ink" : "text-ink-faint hover:text-ink";
  return (
    <th className="px-4 py-3 font-medium">
      {href ? (
        <Link href={href} className={className}>
          {label}
          {marker}
        </Link>
      ) : (
        <button type="button" onClick={onSort} className={className}>
          {label}
          {marker}
        </button>
      )}
    </th>
  );
}
