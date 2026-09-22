"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AffiliateOrgChart,
  type AffiliateOrgChartApi,
} from "@/components/affiliate-org-chart";
import {
  IconClose,
  IconCollapseAll,
  IconExpand,
  IconExpandAll,
  IconExitMonitor,
  IconFit,
  IconMonitor,
  IconSearch,
  IconZoomIn,
  IconZoomOut,
} from "@/components/icons";
import {
  TABLE_BTN_ICON,
  TableIconAction,
  TableLabelButton,
} from "@/components/table-chrome";
import {
  AFFILIATE_ORG_LAYOUTS,
  affiliateOrgLayoutLabel,
  flattenAffiliateOrgChart,
  searchAffiliateOrgChart,
  type AffiliateOrgLayout,
} from "@/lib/membership/affiliate";
import { useUiPreferences } from "@/components/ui-preferences";
import type { AffiliateTreeNode } from "@/lib/membership/affiliate-store";

const groupRule = "hidden h-6 w-px bg-line sm:block";
const searchFieldClass =
  "w-56 rounded-control border border-line bg-canvas py-1.5 pl-8 pr-8 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none [&::-webkit-search-cancel-button]:appearance-none";

export function AffiliateOrgChartFrame({
  nodes,
  rootPlanName,
}: {
  nodes: AffiliateTreeNode[];
  rootPlanName?: string | null;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const { content } = useUiPreferences();
  const [expanded, setExpanded] = useState(false);
  const [monitor, setMonitor] = useState(false);
  const [api, setApi] = useState<AffiliateOrgChartApi | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [foundId, setFoundId] = useState<string | null>(null);
  const [layout, setLayout] = useState<AffiliateOrgLayout>("top");
  const searchId = useId();
  const listId = `${searchId}-list`;
  const rows = useMemo(() => flattenAffiliateOrgChart(nodes), [nodes]);
  const hits = useMemo(
    () => searchAffiliateOrgChart(rows, query),
    [rows, query],
  );

  function rememberPerson(id: string, label: string) {
    setQuery(label);
    setFoundId(id);
    setOpen(false);
  }

  function choosePerson(id: string, label: string) {
    rememberPerson(id, label);
    api?.findPerson(id);
  }

  function clearFind() {
    setQuery("");
    setFoundId(null);
    setOpen(false);
    setActive(0);
    api?.clearFind();
  }

  useEffect(() => {
    const onFullscreen = () => {
      const active = document.fullscreenElement === frameRef.current;
      setMonitor(active);
      if (active) {
        setExpanded(true);
      }
      window.setTimeout(() => {
        api?.resize();
        api?.refit();
      }, 80);
    };
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, [api]);

  useEffect(() => {
    if (!expanded) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement && !open) {
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.setTimeout(() => {
      api?.resize();
      api?.refit();
    }, 80);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded, api, open]);

  async function enterMonitor() {
    const node = frameRef.current;
    if (!node) {
      return;
    }
    setExpanded(true);
    try {
      await node.requestFullscreen();
    } catch {
      setMonitor(false);
    }
  }

  async function exitMonitor() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  }

  async function closeExpand() {
    await exitMonitor();
    setExpanded(false);
  }

  return (
    <section
      ref={frameRef}
      aria-label="Org chart"
      className={
        expanded
          ? `affiliate-org-chart-frame${content === "light" ? " theme-light" : ""} fixed inset-0 z-50 flex flex-col bg-canvas p-6`
          : `affiliate-org-chart-frame${content === "light" ? " theme-light" : ""} rounded-card border border-line bg-surface p-5`
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {nodes.length > 0 ? (
            <div
              role="group"
              aria-label="Chart layout"
              className="flex w-fit rounded-control border border-line bg-canvas p-0.5"
            >
              {AFFILIATE_ORG_LAYOUTS.map((option) => {
                const selected = layout === option;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={!api}
                    aria-pressed={selected}
                    className={
                      selected
                        ? "rounded-control bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink"
                        : "rounded-control px-3 py-1.5 text-xs text-ink-muted hover:text-ink disabled:text-ink-faint"
                    }
                    onClick={() => {
                      setLayout(option);
                      api?.setLayout(option);
                    }}
                  >
                    {affiliateOrgLayoutLabel(option)}
                  </button>
                );
              })}
            </div>
          ) : null}
          {nodes.length > 0 ? (
            <div
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setOpen(false);
                }
              }}
            >
              <label className="sr-only" htmlFor={searchId}>
                Search name
              </label>
              <div className="relative">
                <IconSearch
                  size={16}
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
                />
                <input
                  id={searchId}
                  type="search"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={open && hits.length > 0}
                  aria-controls={listId}
                  aria-activedescendant={
                    open && hits[active]
                      ? `${listId}-${hits[active].id}`
                      : undefined
                  }
                  value={query}
                  placeholder="Search name"
                  autoComplete="off"
                  className={searchFieldClass}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setOpen(true);
                    setActive(0);
                    if (foundId) {
                      setFoundId(null);
                      api?.clearFind();
                    }
                  }}
                  onFocus={() => setOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" && hits.length > 0) {
                      event.preventDefault();
                      setOpen(true);
                      setActive((index) => (index + 1) % hits.length);
                      return;
                    }
                    if (event.key === "ArrowUp" && hits.length > 0) {
                      event.preventDefault();
                      setOpen(true);
                      setActive((index) =>
                        index === 0 ? hits.length - 1 : index - 1,
                      );
                      return;
                    }
                    if (event.key === "Enter" && hits[active]) {
                      event.preventDefault();
                      choosePerson(hits[active].id, hits[active].label);
                      return;
                    }
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      if (open) {
                        event.preventDefault();
                        setOpen(false);
                      } else if (query) {
                        event.preventDefault();
                        clearFind();
                      }
                    }
                  }}
                />
                {query ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-control text-ink-muted hover:text-ink"
                    onClick={clearFind}
                  >
                    <IconClose {...TABLE_BTN_ICON} />
                  </button>
                ) : null}
              </div>
              {open && query.trim() && hits.length > 0 ? (
                <ul
                  id={listId}
                  role="listbox"
                  className="absolute z-10 mt-1 max-h-64 w-56 overflow-auto rounded-control border border-line bg-surface-raised py-1"
                >
                  {hits.map((hit, index) => (
                    <li key={hit.id} role="presentation">
                      <button
                        type="button"
                        id={`${listId}-${hit.id}`}
                        role="option"
                        aria-selected={index === active}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                          index === active
                            ? "bg-canvas text-ink"
                            : "text-ink hover:bg-canvas"
                        }`}
                        onMouseEnter={() => setActive(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => choosePerson(hit.id, hit.label)}
                      >
                        <span>{hit.label}</span>
                        <span className="text-xs text-ink-muted">
                          {hit.level === 0 ? "You" : `L${hit.level}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {open && query.trim() && hits.length === 0 ? (
                <p className="absolute z-10 mt-1 w-56 rounded-control border border-line bg-surface-raised px-3 py-2 text-xs text-ink-muted">
                  No one matched that.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        {nodes.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <TableLabelButton
                variant="secondary"
                icon={<IconExpandAll {...TABLE_BTN_ICON} />}
                disabled={!api}
                onClick={() => api?.expandAll()}
              >
                Expand all
              </TableLabelButton>
              <TableLabelButton
                variant="secondary"
                icon={<IconCollapseAll {...TABLE_BTN_ICON} />}
                disabled={!api}
                onClick={() => api?.collapseAll()}
              >
                Collapse all
              </TableLabelButton>
            </div>
            <span className={groupRule} aria-hidden />
            <div className="flex items-center">
              <TableIconAction
                label="Fit"
                detail="Fit the whole chart in view."
                disabled={!api}
                onClick={() => api?.fit()}
              >
                <IconFit {...TABLE_BTN_ICON} />
              </TableIconAction>
              <TableIconAction
                label="Zoom out"
                detail="Show more of the chart."
                disabled={!api}
                onClick={() => api?.zoomOut()}
              >
                <IconZoomOut {...TABLE_BTN_ICON} />
              </TableIconAction>
              <TableIconAction
                label="Zoom in"
                detail="Show less of the chart."
                disabled={!api}
                onClick={() => api?.zoomIn()}
              >
                <IconZoomIn {...TABLE_BTN_ICON} />
              </TableIconAction>
            </div>
            <span className={groupRule} aria-hidden />
            <div className="flex items-center">
              {!expanded ? (
                <TableIconAction
                  label="Expand"
                  detail="Fill the browser with this chart."
                  onClick={() => setExpanded(true)}
                >
                  <IconExpand {...TABLE_BTN_ICON} />
                </TableIconAction>
              ) : null}
              {monitor ? (
                <TableIconAction
                  label="Exit fullscreen"
                  detail="Leave monitor fullscreen."
                  onClick={() => void exitMonitor()}
                >
                  <IconExitMonitor {...TABLE_BTN_ICON} />
                </TableIconAction>
              ) : (
                <TableIconAction
                  label="Fullscreen"
                  detail="Open this chart on the monitor."
                  onClick={() => void enterMonitor()}
                >
                  <IconMonitor {...TABLE_BTN_ICON} />
                </TableIconAction>
              )}
              {expanded && !monitor ? (
                <TableIconAction
                  label="Close"
                  detail="Leave the expanded chart."
                  onClick={() => void closeExpand()}
                >
                  <IconClose {...TABLE_BTN_ICON} />
                </TableIconAction>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {nodes.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">
          The chart fills as people join with your code.
        </p>
      ) : (
        <div
          className={
            expanded
              ? "mt-4 min-h-0 flex-1 overflow-hidden rounded-card border border-line bg-canvas"
              : "mt-3 h-[min(36rem,70vh)] overflow-hidden rounded-control border border-line bg-canvas"
          }
        >
          <AffiliateOrgChart
            nodes={nodes}
            rootPlanName={rootPlanName}
            onSelect={rememberPerson}
            onReady={setApi}
          />
        </div>
      )}
    </section>
  );
}
