"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  type FormEvent,
  type MouseEvent,
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
  tablePagerItems,
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
      data-table-card=""
      className={`scroll-mt-20 overflow-hidden rounded-card border border-line bg-surface ${className}`.trim()}
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

export function TableSectionTitle({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle?: string;
  count?: number;
}) {
  return (
    <div className="min-w-0">
      <h2 className="text-lg font-semibold tracking-tight text-ink">
        {title}
        {count != null ? (
          <span className="font-semibold"> ({count})</span>
        ) : null}
      </h2>
      {subtitle ? <p className="text-sm text-ink-muted">{subtitle}</p> : null}
    </div>
  );
}

export function TableFilterSession({
  children,
  title,
  toolbar,
  actions,
  defaultOpen = false,
  id,
}: {
  children?: ReactNode;
  title?: ReactNode;
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
  const filtersVisible = hasFilters && show;
  const bulkVisible = Boolean(toolbar);
  const liftTitle = Boolean(title) && (filtersVisible || bulkVisible);
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
  const chrome =
    bulkVisible ||
    Boolean(actions) ||
    (hasFilters && !show) ||
    (Boolean(title) && !liftTitle);
  const rowGap = title
    ? filtersVisible
      ? "mt-4 mb-3"
      : "mb-3"
    : filtersVisible
      ? "mt-4"
      : hasFilters
        ? "mt-6"
        : "mb-3";
  return (
    <FilterBarEndCtx.Provider value={filtersVisible ? hideButton : null}>
      {liftTitle ? <div className="mb-3">{title}</div> : null}
      {filtersVisible ? children : null}
      {chrome ? (
        <div
          className={`flex flex-wrap items-center gap-2 ${rowGap} ${
            toolbar || (title && !liftTitle) ? "justify-between" : "justify-end"
          }`}
        >
          {title && !liftTitle ? (
            <div className="min-w-0">{title}</div>
          ) : toolbar ? (
            <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          ) : null}
          {actions || (hasFilters && !show) ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">
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
  onPage,
  pageHrefs,
  emptyLabel,
  align = "center",
  buttons = "icons",
  className = "",
  scroll = true,
}: {
  window: Pick<TablePageWindow, "page" | "pageCount" | "total" | "from" | "to">;
  prevHref?: string;
  nextHref?: string;
  onPrev?: () => void;
  onNext?: () => void;
  onPage?: (page: number) => void;
  pageHrefs?: Record<number, string>;
  emptyLabel?: string;
  align?: "split" | "center";
  buttons?: "text" | "icons";
  className?: string;
  scroll?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const flight = useRef(0);
  const router = useRouter();
  if (window.total === 0) {
    return null;
  }
  const showButtons = window.pageCount > 1;
  const icons = buttons === "icons";
  const items = tablePagerItems(window.page, window.pageCount);
  function showPage(apply: () => void) {
    if (!scroll) {
      apply();
      return;
    }
    const id = flight.current + 1;
    flight.current = id;
    void scrollTableSlowly(rootRef.current).then(() => {
      if (flight.current !== id) {
        return;
      }
      apply();
    });
  }
  function followHref(event: MouseEvent<HTMLElement>, href: string) {
    if (!isPlainLeftClick(event)) {
      return;
    }
    event.preventDefault();
    showPage(() => router.push(href));
  }
  return (
    <div
      ref={rootRef}
      className={`flex flex-wrap items-center gap-12 text-sm text-ink-muted ${
        align === "center" ? "justify-center" : "justify-between"
      } ${className}`.trim()}
    >
      <p>{tablePageLabel({ ...window, empty: emptyLabel })}</p>
      {showButtons ? (
        <nav aria-label="Pages" className="flex items-center gap-1">
          <PagerButton
            kind="prev"
            href={prevHref}
            onFollow={
              prevHref ? (event) => followHref(event, prevHref) : undefined
            }
            onClick={
              prevHref
                ? undefined
                : () =>
                    showPage(() =>
                      onPage ? onPage(window.page - 1) : onPrev?.(),
                    )
            }
            disabled={window.page <= 1}
            icons={icons}
          />
          {items.map((item, index) =>
            item === "gap" ? (
              <span
                key={`gap-${index}`}
                className="px-1 text-ink-faint"
                aria-hidden
              >
                …
              </span>
            ) : (
              <PagerPage
                key={item}
                page={item}
                current={item === window.page}
                href={
                  pageHrefs && item !== window.page
                    ? pageHrefs[item]
                    : undefined
                }
                onFollow={
                  pageHrefs && item !== window.page
                    ? (event) => followHref(event, pageHrefs[item] ?? "")
                    : undefined
                }
                onClick={
                  !pageHrefs && onPage && item !== window.page
                    ? () => showPage(() => onPage(item))
                    : undefined
                }
              />
            ),
          )}
          <PagerButton
            kind="next"
            href={nextHref}
            onFollow={
              nextHref ? (event) => followHref(event, nextHref) : undefined
            }
            onClick={
              nextHref
                ? undefined
                : () =>
                    showPage(() =>
                      onPage ? onPage(window.page + 1) : onNext?.(),
                    )
            }
            disabled={window.page >= window.pageCount}
            icons={icons}
          />
        </nav>
      ) : null}
    </div>
  );
}

function isPlainLeftClick(event: MouseEvent<HTMLElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function scrollableParent(node: HTMLElement): HTMLElement | null {
  let current = node.parentElement;
  while (current && current !== document.body) {
    const style = getComputedStyle(current);
    const overflow = `${style.overflowY} ${style.overflow}`;
    if (
      /(auto|scroll)/.test(overflow) &&
      current.scrollHeight > current.clientHeight + 1
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function scrollTableSlowly(from: HTMLElement | null): Promise<void> {
  const card = from?.closest("[data-table-card]");
  if (!(card instanceof HTMLElement)) {
    return Promise.resolve();
  }
  const margin = Number.parseFloat(getComputedStyle(card).scrollMarginTop) || 0;
  const parent = scrollableParent(card);
  const start = parent ? parent.scrollTop : window.scrollY;
  const top = parent
    ? parent.scrollTop +
      card.getBoundingClientRect().top -
      parent.getBoundingClientRect().top -
      margin
    : window.scrollY + card.getBoundingClientRect().top - margin;
  const distance = top - start;
  if (Math.abs(distance) < 2) {
    return Promise.resolve();
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if (parent) {
      parent.scrollTop = top;
    } else {
      window.scrollTo(0, top);
    }
    return Promise.resolve();
  }
  const duration = Math.min(1100, Math.max(550, Math.abs(distance) * 0.55));
  const started = performance.now();
  return new Promise((resolve) => {
    function frame(now: number) {
      const t = Math.min(1, (now - started) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
      const next = start + distance * eased;
      if (parent) {
        parent.scrollTop = next;
      } else {
        window.scrollTo(0, next);
      }
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

function PagerPage({
  page,
  current,
  href,
  onFollow,
  onClick,
}: {
  page: number;
  current: boolean;
  href?: string;
  onFollow?: (event: MouseEvent<HTMLElement>) => void;
  onClick?: () => void;
}) {
  const className = `inline-flex h-8 min-w-8 items-center justify-center rounded-control border px-2 text-sm tabular-nums ${
    current
      ? "border-accent bg-accent/15 text-accent"
      : "border-line text-ink-muted hover:bg-surface-raised hover:text-ink"
  }`;
  if (current) {
    return (
      <span className={className} aria-current="page">
        {page}
      </span>
    );
  }
  if (href) {
    return (
      <Link
        href={href}
        scroll={false}
        className={className}
        aria-label={`Page ${page}`}
        onClick={onFollow}
      >
        {page}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={className}
      aria-label={`Page ${page}`}
      onClick={() => onClick?.()}
    >
      {page}
    </button>
  );
}

function PagerButton({
  kind,
  href,
  onFollow,
  onClick,
  disabled,
  icons,
}: {
  kind: "prev" | "next";
  href?: string;
  onFollow?: (event: MouseEvent<HTMLElement>) => void;
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
        <Link
          href={href}
          scroll={false}
          className={className}
          onClick={(event) => {
            dismiss();
            onFollow?.(event);
          }}
          {...spoken}
          {...hover}
        >
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
          if (disabled) {
            return;
          }
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

  const replaceView = useCallback(
    (next: { sortKey: string; sortDir: TableSortDir; page: number }) => {
      setSortKey(next.sortKey);
      setSortDir(next.sortDir);
      setPage(next.page);
    },
    [],
  );

  return {
    pageRows: sliced.rows,
    window: sliced.window,
    sortKey,
    sortDir,
    onSort,
    setPage,
    replaceView,
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
