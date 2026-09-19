"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AffiliateOrgChart,
  type AffiliateOrgChartApi,
} from "@/components/affiliate-org-chart";
import {
  AFFILIATE_ORG_LAYOUTS,
  affiliateOrgLayoutLabel,
  flattenAffiliateOrgChart,
  searchAffiliateOrgChart,
  type AffiliateOrgLayout,
} from "@/lib/membership/affiliate";
import { useUiPreferences } from "@/components/ui-preferences";
import type { AffiliateTreeNode } from "@/lib/membership/affiliate-store";

const control =
  "rounded-control border border-line px-3 py-1.5 text-xs text-ink hover:border-line-strong disabled:text-ink-faint disabled:hover:border-line";

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
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
        </div>
        {nodes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={control}
              disabled={!api}
              onClick={() => api?.expandAll()}
            >
              Expand all
            </button>
            <button
              type="button"
              className={control}
              disabled={!api}
              onClick={() => api?.collapseAll()}
            >
              Collapse all
            </button>
            <button
              type="button"
              className={control}
              disabled={!api}
              onClick={() => api?.fit()}
            >
              Fit
            </button>
            <button
              type="button"
              className={control}
              disabled={!api}
              onClick={() => api?.zoomOut()}
            >
              Zoom out
            </button>
            <button
              type="button"
              className={control}
              disabled={!api}
              onClick={() => api?.zoomIn()}
            >
              Zoom in
            </button>
            {!expanded ? (
              <button
                type="button"
                className={control}
                onClick={() => setExpanded(true)}
              >
                Expand
              </button>
            ) : null}
            {monitor ? (
              <button
                type="button"
                className={control}
                onClick={() => void exitMonitor()}
              >
                Exit fullscreen
              </button>
            ) : (
              <button
                type="button"
                className={control}
                onClick={() => void enterMonitor()}
              >
                Fullscreen
              </button>
            )}
            {expanded && !monitor ? (
              <button
                type="button"
                className={control}
                onClick={() => void closeExpand()}
              >
                Close
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {nodes.length > 0 ? (
        <div
          className="relative mt-3 max-w-md"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setOpen(false);
            }
          }}
        >
          <label className="text-xs text-ink-muted" htmlFor={searchId}>
            Find a person
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id={searchId}
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open && hits.length > 0}
              aria-controls={listId}
              aria-activedescendant={
                open && hits[active] ? `${listId}-${hits[active].id}` : undefined
              }
              value={query}
              placeholder="Name"
              autoComplete="off"
              className="w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
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
              <button type="button" className={control} onClick={clearFind}>
                Clear
              </button>
            ) : null}
          </div>
          {open && query.trim() && hits.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-control border border-line bg-surface-raised py-1"
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
            <p className="mt-2 text-sm text-ink-muted">No one matched that.</p>
          ) : null}
        </div>
      ) : null}
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
