"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LiveFilterSubmit } from "@/components/app-select";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsUp,
  IconFilters,
} from "@/components/icons";
import {
  TABLE_BTN_ICON,
  TableHint,
  TableLabelButton,
  useActionHint,
} from "@/components/table-actions";
import {
  formatStatusLabel,
  sliceTablePage,
  statusToneFor,
  tableFiltersOpenScopeFromSearch,
  tableFiltersOpenStorageKey,
  tablePageLabel,
  toggleTableSortDir,
  type StatusTone,
  type TablePageWindow,
  type TableSortDir,
} from "@/lib/table-chrome";

export {
  TableActions,
  TableHint,
  TableIconAction,
  TableLabelButton,
  TablePendingIconAction,
  TablePendingLabelButton,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TABLE_LABEL_BTN_CLASS,
  useActionHint,
} from "@/components/table-actions";

export const TABLE_TITLE_CASE_TH_CLASS = "normal-case tracking-normal";
export const TABLE_THEAD_CLASS = "border-b border-line bg-surface-raised";

export const TABLE_FILTER_FIELD_CLASS =
  "mt-1 w-full min-w-[9rem] rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";
export const TABLE_PAGER_BTN_CLASS =
  "rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-40";
const TABLE_PAGER_ICON_CLASS =
  "inline-flex size-8 items-center justify-center rounded-control border border-line text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-40";

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

export function TableCard({
  children,
  pager,
  className = "mt-6",
}: {
  children: ReactNode;
  pager?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-card border border-line bg-surface ${className}`.trim()}
    >
      <div className="min-w-0 overflow-x-auto">{children}</div>
      {pager ? (
        <div className="border-t border-line px-4 py-3 empty:hidden">{pager}</div>
      ) : null}
    </div>
  );
}

const FilterBarEndCtx = createContext<ReactNode>(null);

function readFiltersOpen(scope: string): boolean | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(scope);
    if (raw === "1") {
      return true;
    }
    if (raw === "0") {
      return false;
    }
  } catch {
    return null;
  }
  return null;
}

function writeFiltersOpen(scope: string, open: boolean) {
  try {
    window.sessionStorage.setItem(scope, open ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}

export function TableFilterSession({
  children,
  toolbar,
  actions,
  defaultOpen = false,
  id,
}: {
  children?: ReactNode;
  toolbar?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  id?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scope = tableFiltersOpenStorageKey({
    pathname,
    tab: searchParams.get("tab"),
    view: searchParams.get("view"),
    id,
  });
  const [show, setShow] = useState(defaultOpen);

  useLayoutEffect(() => {
    if (defaultOpen) {
      setShow(true);
      return;
    }
    setShow(readFiltersOpen(scope) === true);
  }, [defaultOpen, scope]);

  function openFilters() {
    setShow(true);
    writeFiltersOpen(scope, true);
  }

  function hideFilters() {
    setShow(false);
    writeFiltersOpen(scope, false);
  }
  const hasFilters = children != null;
  const hideButton = (
    <TableLabelButton
      variant="filter"
      icon={<IconChevronsUp {...TABLE_BTN_ICON} />}
      onClick={hideFilters}
    >
      Hide Filters
    </TableLabelButton>
  );
  const showButton = (
    <TableLabelButton
      variant="filter"
      icon={<IconFilters {...TABLE_BTN_ICON} />}
      onClick={openFilters}
    >
      Show Filters
    </TableLabelButton>
  );
  const chrome = Boolean(toolbar) || Boolean(actions) || (hasFilters && !show);
  return (
    <FilterBarEndCtx.Provider value={hasFilters && show ? hideButton : null}>
      {hasFilters && show ? children : null}
      {chrome ? (
        <div
          className={`flex flex-wrap items-center gap-2 ${
            hasFilters && show ? "mt-4" : hasFilters ? "mt-6" : "mb-3"
          } ${toolbar ? "justify-between" : "justify-end"}`}
        >
          {toolbar ? (
            <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          ) : null}
          {actions || (hasFilters && !show) ? (
            <div className="flex flex-wrap items-center gap-2">
              {actions}
              {hasFilters && !show ? showButton : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </FilterBarEndCtx.Provider>
  );
}

function FilterBarEnd() {
  return useContext(FilterBarEndCtx);
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
      <div className="flex flex-wrap items-end gap-3">
        {children}
        <FilterBarEnd />
      </div>
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
    <label className={`block text-sm text-ink ${className}`.trim()}>
      {label}
      {children}
    </label>
  );
}

export function LiveGetForm({
  children,
  className = "mt-6",
  action,
  bare = false,
}: {
  children: ReactNode;
  className?: string;
  action?: string;
  bare?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<number>(0);
  const persistOpen = !bare;
  const submit = useCallback(
    () => submitFilters(formRef.current, persistOpen),
    [persistOpen],
  );

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
        submitFilters(formRef.current, persistOpen);
      }, 300);
      return;
    }
    submitFilters(formRef.current, persistOpen);
  }

  return (
    <LiveFilterSubmit.Provider value={submit}>
      <form
        ref={formRef}
        method="get"
        action={action}
        onChange={onChange}
        className={
          bare
            ? className
            : `rounded-card border border-line bg-surface p-4 ${className}`.trim()
        }
      >
        {bare ? (
          children
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            {children}
            <FilterBarEnd />
          </div>
        )}
      </form>
    </LiveFilterSubmit.Provider>
  );
}

function submitFilters(form: HTMLFormElement | null, persistOpen = true) {
  if (!form) {
    return;
  }
  const page = form.elements.namedItem("page");
  if (page instanceof HTMLInputElement) {
    page.value = "1";
  }
  if (persistOpen) {
    writeFiltersOpen(
      tableFiltersOpenScopeFromSearch(
        window.location.pathname,
        window.location.search,
      ),
      true,
    );
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
  align = "center",
  buttons = "icons",
  className = "",
}: {
  window: Pick<TablePageWindow, "page" | "pageCount" | "total" | "from" | "to">;
  prevHref?: string;
  nextHref?: string;
  onPrev?: () => void;
  onNext?: () => void;
  emptyLabel?: string;
  align?: "split" | "center";
  buttons?: "text" | "icons";
  className?: string;
}) {
  if (window.total === 0) {
    return null;
  }
  const showButtons = window.pageCount > 1;
  const icons = buttons === "icons";
  return (
    <div
      className={`flex flex-wrap items-center gap-3 text-sm text-ink-muted ${
        align === "center" ? "justify-center" : "justify-between"
      } ${className}`.trim()}
    >
      <p>{tablePageLabel({ ...window, empty: emptyLabel })}</p>
      {showButtons ? (
        <div className="flex gap-2">
          <PagerButton
            kind="prev"
            href={prevHref}
            onClick={onPrev}
            disabled={window.page <= 1}
            icons={icons}
          />
          <PagerButton
            kind="next"
            href={nextHref}
            onClick={onNext}
            disabled={window.page >= window.pageCount}
            icons={icons}
          />
        </div>
      ) : null}
    </div>
  );
}

function PagerButton({
  kind,
  href,
  onClick,
  disabled,
  icons,
}: {
  kind: "prev" | "next";
  href?: string;
  onClick?: () => void;
  disabled: boolean;
  icons: boolean;
}) {
  const { box, dismiss, tip } = useActionHint();
  const label = kind === "prev" ? "Previous" : "Next";
  const detail =
    kind === "prev" ? "Show the previous page." : "Show the next page.";
  if (!icons && disabled) {
    return null;
  }
  const className = icons ? TABLE_PAGER_ICON_CLASS : TABLE_PAGER_BTN_CLASS;
  const body = icons ? (
    kind === "prev" ? (
      <IconChevronLeft size={16} className="size-4" />
    ) : (
      <IconChevronRight size={16} className="size-4" />
    )
  ) : (
    label
  );
  const spoken = icons
    ? { "aria-label": `${label}. ${detail}` as const }
    : {};
  const tooltip = icons ? (
    <TableHint box={box} label={label} detail={detail} />
  ) : null;
  const hover = icons ? tip : {};
  if (href && !disabled) {
    return (
      <>
        <Link href={href} className={className} onClick={dismiss} {...spoken} {...hover}>
          {body}
        </Link>
        {tooltip}
      </>
    );
  }
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        className={className}
        onClick={() => {
          dismiss();
          onClick?.();
        }}
        {...spoken}
        {...hover}
      >
        {body}
      </button>
      {tooltip}
    </>
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
  className = "",
}: {
  label: string;
  active: boolean;
  dir: TableSortDir;
  onSort?: () => void;
  href?: string;
  className?: string;
}) {
  const marker = active ? (
    <span className="ml-1 text-ink" aria-hidden>
      {dir === "asc" ? "↑" : "↓"}
    </span>
  ) : null;
  const tone = active ? "text-ink" : "text-ink-faint hover:text-ink";
  const ariaSort = active ? (dir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th
      className={`px-4 py-3 font-medium ${className}`.trim()}
      aria-sort={ariaSort}
    >
      {href ? (
        <Link href={href} className={tone}>
          {label}
          {marker}
        </Link>
      ) : (
        <button type="button" onClick={onSort} className={tone}>
          {label}
          {marker}
        </button>
      )}
    </th>
  );
}
