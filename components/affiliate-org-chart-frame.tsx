"use client";

import { useEffect, useRef, useState } from "react";
import {
  AffiliateOrgChart,
  type AffiliateOrgChartApi,
} from "@/components/affiliate-org-chart";
import { affiliateDownlineRowHref } from "@/lib/membership/affiliate";
import type { AffiliateTreeNode } from "@/lib/membership/affiliate-store";

const control =
  "rounded-control border border-line px-3 py-1.5 text-xs text-ink hover:border-line-strong disabled:text-ink-faint disabled:hover:border-line";

export function AffiliateOrgChartFrame({
  nodes,
  downline,
}: {
  nodes: AffiliateTreeNode[];
  downline: readonly { userId: string }[];
}) {
  const rowHref = (userId: string) => affiliateDownlineRowHref(userId, downline);
  const frameRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [monitor, setMonitor] = useState(false);
  const [api, setApi] = useState<AffiliateOrgChartApi | null>(null);

  useEffect(() => {
    const onFullscreen = () => {
      const active = document.fullscreenElement === frameRef.current;
      setMonitor(active);
      if (active) {
        setExpanded(true);
      }
      window.setTimeout(() => {
        api?.resize();
        api?.fit();
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
      if (event.key === "Escape" && !document.fullscreenElement) {
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.setTimeout(() => {
      api?.resize();
      api?.fit();
    }, 80);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded, api]);

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
      className={
        expanded
          ? "affiliate-org-chart-frame fixed inset-0 z-50 flex flex-col bg-canvas p-6"
          : "affiliate-org-chart-frame rounded-card border border-line bg-surface p-5"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Org chart</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Drag to pan. Scroll to zoom. Use + on a node to expand that branch.
          </p>
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
            rowHref={rowHref}
            onReady={setApi}
          />
        </div>
      )}
    </section>
  );
}
