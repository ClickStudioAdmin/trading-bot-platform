"use client";

import { useEffect, useRef, useState } from "react";
import { AffiliateOrgChart } from "@/components/affiliate-org-chart";
import type { AffiliateTreeNode } from "@/lib/membership/affiliate-store";

export function AffiliateOrgChartFrame({
  nodes,
}: {
  nodes: AffiliateTreeNode[];
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [monitor, setMonitor] = useState(false);

  useEffect(() => {
    const onFullscreen = () => {
      const active = document.fullscreenElement === frameRef.current;
      setMonitor(active);
      if (active) {
        setExpanded(true);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

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
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

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
          ? "fixed inset-0 z-50 flex flex-col bg-canvas p-6"
          : "rounded-card border border-line bg-surface p-5"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Org chart</h2>
        {nodes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {!expanded ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="rounded-control border border-line px-3 py-1.5 text-xs text-ink hover:border-line-strong"
              >
                Expand
              </button>
            ) : null}
            {monitor ? (
              <button
                type="button"
                onClick={() => void exitMonitor()}
                className="rounded-control border border-line px-3 py-1.5 text-xs text-ink hover:border-line-strong"
              >
                Exit fullscreen
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void enterMonitor()}
                className="rounded-control border border-line px-3 py-1.5 text-xs text-ink hover:border-line-strong"
              >
                Fullscreen
              </button>
            )}
            {expanded && !monitor ? (
              <button
                type="button"
                onClick={() => void closeExpand()}
                className="rounded-control border border-line px-3 py-1.5 text-xs text-ink hover:border-line-strong"
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
              ? "mt-4 min-h-0 flex-1 overflow-auto rounded-card border border-line bg-surface p-5 text-base"
              : "mt-3"
          }
        >
          <AffiliateOrgChart nodes={nodes} />
        </div>
      )}
    </section>
  );
}
